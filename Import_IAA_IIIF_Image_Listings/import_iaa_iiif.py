#!/usr/bin/python3

# This reads in in a simple .txt file containing a list of filenames.
# The IAA's iiif server code address is hardcoded on line 90.
# We grab the info.json file for the image and get width and height.
# Then we parse the filename, look up the plate and fragment in the DB.
# Finally we write a new SQE_image entry from the filename.
import sys, getopt
import json
import requests
import mysql.connector
import re
from tqdm import tqdm
from mysql.connector.pooling import MySQLConnectionPool

def main(argv):
    inputfile = ''
    database = ''
    try:
        opts, args = getopt.getopt(argv,"hi:d:",["ifile=","db="])
    except getopt.GetoptError:
        print('test.py -i <inputfile> -d <database_name>')
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('test.py -i <inputfile> -d <database_name>')
            sys.exit()
        elif opt in ("-i", "--ifile"):
            inputfile = arg
        elif opt in ("-d", "--db"):
            database = arg
    print('Input file is', inputfile)
    print('Database is', database.rstrip(' '))

    dbconfig = {'host': "localhost",
                'port': "3307",
                'user': "root",
                'password': "none",
                'database': database
                }

    cnxpool = MySQLConnectionPool(
        pool_name = "mypool",
        pool_size = 10,
        **dbconfig)

    db = cnxpool.get_connection()
    cursor = db.cursor()
    unprocessed = []
    processed = []
    lines = [line.rstrip('\n') for line in open(inputfile)]
    for line in tqdm(lines):
        try:
            req = requests.get('https://www.qumranica.org/image-proxy?address=http://192.114.7.208:8182/iiif/2/' + line + '/info.json')
            resp = req.json()
            height = resp["height"]
            width = resp["width"]
            m = re.search(r'([X|\*]{0,1}\d{1,5}.*)(-Fg|Fg)(\d{1,5}).*-(R|V)-.*(LR445|LR924|ML445|ML924|_026|_028)', line)
            if m is not None and len(m.groups(0)) == 5:
                plate = str(m.group(1).replace('Rec', '').replace('Vrs', '').replace('_', '/').replace('X', '*').replace('-', '/').rstrip('/'))
                fragment = str(m.group(3)).lstrip('0')
                side = '0'
                if ('R' in str(m.group(4))):
                    side = '0'
                else:
                    side = '1'
                wvStart = '0'
                wvEnd = '0'
                imgType = '1'
                master = '0'
                if ('445' in str(m.group(5))):
                    wvStart = '445'
                    wvEnd = '704'
                    imgType = '0'
                    master = '1'
                elif ('26' in str(m.group(5))):
                    wvStart = '924'
                    wvEnd = '924'
                    imgType = '2'
                elif ('28' in str(m.group(5))):
                    wvStart = '924'
                    wvEnd = '924'
                    imgType = '3'
                elif ('924' in str(m.group(5))):
                    wvStart = '924'
                    wvEnd = '924'
                sql = """
                    SELECT image_catalog_id FROM image_catalog
                    WHERE institution = "IAA"
                    AND catalog_number_1 = %s
                    AND catalog_number_2 = %s
                    AND catalog_side = %s;
                    """
                cursor.execute(sql, (plate, fragment, side))
                result_set = cursor.fetchall()
                if (len(result_set) == 1):
                    imageCatalogId = str(result_set[0][0])
                    sql = """
                        INSERT INTO SQE_image
                        (image_urls_id, filename,
                            dpi, type, wavelength_start, wavelength_end, is_master,
                            image_catalog_id, native_width, native_height)
                        VALUES(2,%s,1215,%s,%s,%s,%s,%s,%s,%s)
                        ON DUPLICATE KEY UPDATE sqe_image_id=LAST_INSERT_ID(sqe_image_id);
                        """
                    cursor.execute(sql,(line, imgType, wvStart, wvEnd, master, imageCatalogId, width, height))
                    db.commit()
                    processed.append("%s %s" %(line, cursor.lastrowid,))
                else:
                    unprocessed.append(line + " " + plate + " " + fragment)
            else:
                institution = ""
                number_1 = ""
                number_2 = None
                if line[0] == "M" or line[0] == "m":
                    institution = "PAM"
                    pam = re.search(r'[M|m](\d{2})(\d{1,5})-', line)
                    if pam is not None and len(pam.groups()) == 2:
                        number_1 = str(pam.group(1))
                        number_2 = str(pam.group(2))
                elif line[0] == "I":
                    institution = "IDAM-IAA"
                    pam = re.search(r'I(\d{1,7})-', line)
                    if pam is not None and len(pam.groups()) == 1:
                        number_1 = str(pam.group(1))
                        number_2 = None
                elif line[0] == "P":
                    institution = "IAA"
                    pam = re.search(r'P(\d{1,7}.*?\d{1,2})(-F|_n|F)', line)
                    if pam is not None and len(pam.groups()) > 0:
                        number_1 = str(pam.group(1))
                        number_2 = None
                if institution is not "" and number_1 is not "":
                    sql = """
                        INSERT INTO image_catalog (institution, catalog_number_1, catalog_number_2, catalog_side)
                        VALUE (%s, %s, %s, 0)
                        ON DUPLICATE KEY UPDATE image_catalog_id = LAST_INSERT_ID(image_catalog_id)
                        """
                    cursor.execute(sql, (institution, number_1, number_2))
                    db.commit()
                    insert_id = cursor.lastrowid
                    sql = """
                        INSERT INTO SQE_image
                        (image_urls_id, filename,
                            dpi, type, wavelength_start, wavelength_end, is_master,
                            image_catalog_id, native_width, native_height)
                        VALUES(2,%s,800,0,0,0,0,%s,%s,%s)
                        ON DUPLICATE KEY UPDATE sqe_image_id=LAST_INSERT_ID(sqe_image_id);
                        """
                    cursor.execute(sql,(line, insert_id, width, height))
                    db.commit()
                    processed.append("%s %s" %(line, cursor.lastrowid,))
                else:
                    if number_2 is None:
                        number_2 = ""
                    unprocessed.append(line + " " + institution + " " + number_1 + " " + number_2)
        except:
            unprocessed.append(line)
    print("Writing the image_to_image_maps.")
    sql = """
        INSERT IGNORE INTO image_to_image_map (image1_id, image2_id, region_on_image1, region_on_image2)
        SELECT  sqe1.sqe_image_id,
                sqe2.sqe_image_id,
                PolygonFromText(CONCAT('POLYGON((0 0,', sqe1.native_width, ' 0,', sqe1.native_width, ' ', sqe1.native_height, ',0 ', sqe1.native_height, ',0 0))')),
                PolygonFromText(CONCAT('POLYGON((0 0,', sqe2.native_width, ' 0,', sqe2.native_width, ' ', sqe2.native_height, ',0 ', sqe2.native_height, ',0 0))'))
        FROM SQE_image sqe1
        JOIN SQE_image sqe2 ON sqe2.image_catalog_id = sqe1.image_catalog_id
            AND sqe2.sqe_image_id != sqe1.sqe_image_id
        WHERE sqe1.is_master = 1
        """
    cursor.execute(sql)
    db.commit()
    sql = """
        INSERT INTO image_to_image_map_author (image_to_image_map_id, user_id)
        SELECT image_to_image_map.image_to_image_map_id, (SELECT user_id FROM user WHERE user_name = "sqe_api")
        FROM image_to_image_map
        LEFT JOIN image_to_image_map_author ON image_to_image_map_author.image_to_image_map_id = image_to_image_map.image_to_image_map_id
            AND image_to_image_map_author.user_id = (SELECT user_id FROM user WHERE user_name = "sqe_api")
        WHERE image_to_image_map_author.image_to_image_map_id IS NULL
        """
    cursor.execute(sql)
    db.commit()
    cursor.close()
    db.close()
    with open('import_failed.txt', 'w') as f:
        for item in unprocessed:
            f.write("%s\n" % item)
    with open('import_succeeded.txt', 'w') as f:
        for item in processed:
            f.write("%s\n" % item)
    print("%s unsuccessful matches." %(len(unprocessed),))
    print("%s successful matches." %(len(processed),))

if __name__ == "__main__":
   main(sys.argv[1:])