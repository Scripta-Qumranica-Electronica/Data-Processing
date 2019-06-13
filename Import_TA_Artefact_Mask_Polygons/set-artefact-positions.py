# This script grabs all the artefacts of a scroll and gives them a position on
# the virtual scroll so that none of them is overlapping.

import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool
from shapely import wkt, wkb, affinity, geometry
from tqdm import tqdm
import json

dbconfig = {'host': "127.0.0.1",
            'port': '3307',
            'user': "root",
            'password': "none",
            'database': "SQE"
            }

cnxpool = mysql.connector.pooling.MySQLConnectionPool(pool_name = "mypool",
                                                      pool_size = 10,
                                                      **dbconfig)

db = cnxpool.get_connection()
sv_cursor = db.cursor()
svQuery = """
SELECT DISTINCT edition_editor.edition_id, edition_editor.edition_editor_id
FROM artefact_shape_owner
JOIN edition_editor USING(edition_id)
WHERE edition_editor.user_id = (SELECT user_id FROM user WHERE email = "sqe_api")
"""
sv_cursor.execute(svQuery)
for (edition) in tqdm(list(sv_cursor)):
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
            JOIN SQE_image USING(sqe_image_id)
            JOIN image_catalog USING(image_catalog_id)
            WHERE artefact_shape_owner.edition_id = %s
            AND image_catalog.catalog_side = 0
            ORDER BY artefact_shape.artefact_id
            """
    cursor.execute(query % (edition[0]))

    current_x = 0
    max_x = 0
    current_width = 0
    current_y = 0
    master_scale = 1215
    for (art_id, poly, x, y, width, height, dpi) in cursor:
        if current_y > 10000:
            current_width = max_x
            current_x = max_x
            current_y = 0
        scale = master_scale / dpi
        wkt_poly = wkt.loads(poly)
        first_translate = affinity.translate(wkt_poly, xoff=-x, yoff=-y)
        scaled_poly = affinity.scale(first_translate, scale, scale, 1.0, geometry.Point(0, 0, 0))
        translated_poly = affinity.translate(scaled_poly, current_x, current_y)
        translated_wkt_poly = wkt.dumps(translated_poly)

        wkt_point = wkt.loads('POINT(0 0)')
        translate_point = affinity.translate(wkt_point, current_x, current_y)
        translated_wkt_point = wkt.dumps(translate_point)
        matrix = {"matrix": [[1, 0, current_x], [0, 1, current_y]]}
        try:
            db2 = cnxpool.get_connection()
            cursor2 = db2.cursor()
            checkExist = """SELECT transform_matrix
            FROM artefact_position
            JOIN artefact_position_owner USING(artefact_position_id)
            WHERE artefact_position.artefact_id = %s
                AND artefact_position_owner.edition_id = %s"""
            cursor2.execute(checkExist % (int(art_id), edition[0]))
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
                query3 = """INSERT IGNORE INTO artefact_position_owner (artefact_position_id, edition_id, edition_editor_id)
                            VALUES (%s, %s, %s)"""
                cursor2.execute(query3 % (cursor2.lastrowid, edition[0], edition[1]))
                db2.commit()

            cursor2.close()
            db2.close()
        except mysql.connector.Error as error:
            cursor2.close()
            db2.close()
        current_y = translated_poly.bounds[3]
        if translated_poly.bounds[2] > max_x:
            max_x = translated_poly.bounds[2]
    cursor.close()
    db1.close()
sv_cursor.close()
db.close()