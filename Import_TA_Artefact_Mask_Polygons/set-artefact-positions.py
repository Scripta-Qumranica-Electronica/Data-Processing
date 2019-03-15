# This script grabs all the artefacts of a scroll and gives them a position on
# the virtual scroll so that none of them is overlapping.

#TODO I need to get every scroll_version_id first and run this code on each one.
#TODO The first query should be updated to use scroll_version_id, not scroll_id.

import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool
from shapely import wkt, wkb, affinity, geometry
from tqdm import tqdm
import json

dbconfig = {'host': "127.0.0.1",
            'port': '3307',
            'user': "root",
            'password': "none",
            'database': "SQE_DEV"
            }

cnxpool = mysql.connector.pooling.MySQLConnectionPool(pool_name = "mypool",
                                                      pool_size = 10,
                                                      **dbconfig)

db = cnxpool.get_connection()
sv_cursor = db.cursor()
svQuery = """
SELECT DISTINCT scroll_version_id
FROM artefact_shape_owner
JOIN scroll_version USING(scroll_version_id)
WHERE scroll_version.user_id = (SELECT user_id FROM user WHERE user_name = "sqe_api")
"""
sv_cursor.execute(svQuery)
for (scroll_version_id) in tqdm(list(sv_cursor)):
    db1 = cnxpool.get_connection()
    cursor = db1.cursor()
    query = """SELECT artefact_shape.artefact_id, ST_ASWKT(artefact_shape.region_in_sqe_image),
            ST_X(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact_shape.region_in_sqe_image)), 1)) AS x,
            ST_Y(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact_shape.region_in_sqe_image)), 1)) AS y,
            ST_X(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact_shape.region_in_sqe_image)), 3)) AS width,
            ST_Y(ST_PointN(ST_ExteriorRing(ST_ENVELOPE(artefact_shape.region_in_sqe_image)), 3)) AS height,
            SQE_image.dpi
            FROM artefact_shape
            JOIN artefact_shape_owner USING (artefact_shape_id)
            JOIN SQE_image ON artefact_shape.id_of_sqe_image = SQE_image.sqe_image_id
            JOIN image_catalog USING(image_catalog_id)
            WHERE artefact_shape_owner.scroll_version_id = %s
            AND image_catalog.catalog_side = 0
            ORDER BY artefact_shape.artefact_id
            """
    cursor.execute(query % (scroll_version_id))

    current_x = 0
    max_x = 0
    current_width = 0
    current_y = 0
    master_scale = 1215
    for (art_id, poly, x, y, width, height, dpi) in cursor:
        # print('\n')
        # print('Art id: %s' % art_id)
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
        # print("Artefact id is %s" % art_id)
        # print("Matrix is  %s" % matrix)
        try:
            db2 = cnxpool.get_connection()
            cursor2 = db2.cursor()
            checkExist = """SELECT transform_matrix
            FROM artefact_position
            JOIN artefact_position_owner USING(artefact_position_id)
            WHERE artefact_position.artefact_id = %s
                AND artefact_position_owner.scroll_version_id = %s"""
            cursor2.execute(checkExist % (int(art_id), scroll_version_id[0]))
            exists = False
            for (transform_matrix) in cursor2:
                if transform_matrix[0] == json.dumps(matrix):
                    exists = True

            if not exists:
                query2 = """INSERT INTO artefact_position (artefact_id, transform_matrix)
                            VALUES (%s, '%s')
                            ON DUPLICATE KEY UPDATE artefact_position_id=LAST_INSERT_ID(artefact_position_id)"""
                cursor2.execute(query2 % (int(art_id), json.dumps(matrix)))
                db2.commit()
                # print("The last inserted id was: ", cursor2.lastrowid)
                query3 = """INSERT IGNORE INTO artefact_position_owner (artefact_position_id, scroll_version_id)
                            VALUES (%s, %s)"""
                # print(query3 % (cursor2.lastrowid, scroll_version_id[0]))
                cursor2.execute(query3 % (cursor2.lastrowid, scroll_version_id[0]))
                db2.commit()

            cursor2.close()
            db2.close()
        except mysql.connector.Error as error:
            # print("Failed: ", art_id)
            cursor2.close()
            db2.close()
        # print('Current y: %s' % current_y)
        # print('Original poly bounds: %s, %s, %s, %s' % wkt_poly.bounds)
        # print('x: %s, y: %s' % (-x, -y))
        # print('Poly bound: %s, %s, %s, %s' % first_translate.bounds)
        # print('Height %s' % (translated_poly.bounds[3] - translated_poly.bounds[1]))
        # print('Y shift: %s' % translated_poly.bounds[3])
        current_y = translated_poly.bounds[3]
        if translated_poly.bounds[2] > max_x:
            max_x = translated_poly.bounds[2]
    cursor.close()
    db1.close()
sv_cursor.close()
db.close()