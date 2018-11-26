# This script grabs all the artefacts of a scroll and gives them a position on
# the virtual scroll so that none of them is overlapping.

#TODO I need to get every scroll_version_id first and run this code on each one.
#TODO The first query should be updated to use scroll_version_id, not scroll_id.
 
import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool
from shapely import wkt, wkb, affinity, geometry
import json

dbconfig = {'host': "127.0.0.1",
            'port': '3307',
            'user': "root",
            'password': "none",
            'database': "SQE_DEV"
            }

cnxpool = mysql.connector.pooling.MySQLConnectionPool(pool_name = "mypool",
                                                      pool_size = 30,
                                                      **dbconfig)

db = cnxpool.get_connection()
cursor = db.cursor()
query = """SELECT artefact_position.artefact_position_id, ST_ASWKT(artefact.region_in_master_image), 
        ST_X(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact.region_in_master_image)), 1)) AS x, 
        ST_Y(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact.region_in_master_image)), 1)) AS y, 
        ST_X(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact.region_in_master_image)), 3)) AS width, 
        ST_Y(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact.region_in_master_image)), 3)) AS height, 
        SQE_image.dpi 
        FROM artefact_position 
        JOIN artefact_position_owner USING (artefact_position_id) 
        JOIN artefact USING(artefact_id) 
        JOIN SQE_image USING(sqe_image_id) 
        JOIN image_catalog USING(image_catalog_id)
        WHERE artefact_position.scroll_id = 1023
        AND image_catalog.catalog_side = 0 
        """
cursor.execute(query)

current_x = 0
max_x = 0
current_width = 0
current_y = 0
master_scale = 1215
for (art_id, poly, x, y, width, height, dpi) in cursor:
    print('\n')
    print('Art id: %s' % art_id)
    if current_y > 10000:
        current_width = max_x
        current_x = max_x
        current_y = 0
    scale = master_scale / dpi
    wkt_poly = wkt.loads(poly)
    first_translate = affinity.translate(wkt_poly, xoff=-x, yoff=-y)
    scaled_poly = affinity.scale(first_translate, scale, scale, 1.0, geometry.Point(0, 0, 0))
    translated_poly = affinity.translate(scaled_poly, current_x, current_y)
    # translated_poly = affinity.translate(first_translate, current_x, current_y)
    translated_wkt_poly = wkt.dumps(translated_poly)

    wkt_point = wkt.loads('POINT(0 0)')
    translate_point = affinity.translate(wkt_point, current_x, current_y)
    translated_wkt_point = wkt.dumps(translate_point)
    matrix = {"matrix": [[1, 0, current_x], [0, 1, current_y]]}
    print("Artefact is is %s" % art_id)
    print("Matrix is  %s" % matrix)
    try:
        db2 = cnxpool.get_connection()
        cursor2 = db2.cursor()
        query2 = """UPDATE artefact_position
                    SET transform_matrix = '%s'
                    WHERE artefact_position_id = %s """
        print(query2 % (json.dumps(matrix), int(art_id)))
        cursor2.execute(query2 % (json.dumps(matrix), int(art_id)))
        db2.commit()
        print("The last inserted id was: ", cursor2.lastrowid)
        cursor2 .close()
        db2.close()
    except mysql.connector.Error as error:
        print(art_id)
        cursor.close()
        db.close()
    print('Current y: %s' % current_y)
    print('Original poly bounds: %s, %s, %s, %s' % wkt_poly.bounds)
    print('x: %s, y: %s' % (-x, -y))
    print('Poly bound: %s, %s, %s, %s' % first_translate.bounds)
    print('Height %s' % (translated_poly.bounds[3] - translated_poly.bounds[1]))
    print('Y shift: %s' % translated_poly.bounds[3])
    current_y = translated_poly.bounds[3]
    if translated_poly.bounds[2] > max_x:
        max_x = translated_poly.bounds[2]
cursor.close()
db.close()