#!/usr/bin/python3

# This reads in in a simple .txt file containing a list of filenames.
# The IAA's iiif server code address is hardcoded on line 90.
# We grab the info.json file for the image and get width and height.
# Actually, I am not now grabbing the image data from info.json
# because the NLI iiif server is too slow and the images all seem
# to be 7216x5412.
# Then we parse the filename, look up the plate and fragment in the DB.
# Finally we write a new SQE_image entry from the filename.
import sys, getopt
import urllib.request, json
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
        pool_size = 30,
        **dbconfig)

    db = cnxpool.get_connection()
    cursor = db.cursor()
    unprocessed = []
    processed = []
    lines = [line.rstrip('\n') for line in open(inputfile)]
    for line in tqdm(lines):
        m = re.search(r'([X|\*]{0,1}\d{1,5})(\_\d|[a-zA-Z]{0,1}).*Fg(\d{1,5}).*-(R|V)-.*(LR445|LR924|ML445|ML924|_026|_028)', line)
        if m is not None and len(m.groups(0)) == 5:
            plate = str(m.group(1)) + m.group(2).replace('_', '/').replace('X', '*')
            fragment = str(m.group(3)).lstrip('0')
            side = '0'
            if ('R' in str(m.group(4))):
                side = '0'
            else:
                side = '1'
            wvStart = '0'
            wvEnd = '0'
            type = '1'
            master = '0'
            if ('445' in str(m.group(5))):
                wvStart = '445'
                wvEnd = '704'
                type = '0'
                master = '1'
            elif ('26' in str(m.group(5))):
                wvStart = '924'
                wvEnd = '924'
                type = '2'
            elif ('28' in str(m.group(5))):
                wvStart = '924'
                wvEnd = '924'
                type = '3'
            elif ('924' in str(m.group(5))):
                wvStart = '924'
                wvEnd = '924'
            sql = """
                SELECT image_catalog_id, edition_catalog_id FROM image_catalog
                JOIN image_to_edition_catalog USING(image_catalog_id)
                WHERE institution = "IAA"
                AND catalog_number_1 = %s
                AND catalog_number_2 = %s
                AND catalog_side = %s;
                """
            cursor.execute(sql, (plate, fragment, side))
            result_set = cursor.fetchall()
            if (len(result_set) == 1 and len(result_set[0]) == 2):
                imageCatalogId = str(result_set[0][0])
                editionCatalogId = str(result_set[0][1])
                #print(plate, fragment, side, wvStart, wvEnd, type, imageCatalogId, editionCatalogId)
                # exclude = ['1094','1095','1096','1097','1098','1099','1100','1101','1102','1103','1104','1106','1107','998']
                # exclude = []
                # if any(x not in plate for x in exclude): #TODO Probably should remove this check
                sql = """
                    INSERT INTO SQE_image
                    (image_urls_id, filename, native_width, native_height,
                        dpi, type, wavelength_start, wavelength_end, is_master,
                        image_catalog_id)
                    VALUES(2,%s,7216,5412,1215,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE sqe_image_id=LAST_INSERT_ID(sqe_image_id);
                    """
                cursor.execute(sql,(line, type, wvStart, wvEnd, master, imageCatalogId))
                db.commit()
                processed.append("%s %s" %(line, cursor.lastrowid,))
            else:
                unprocessed.append(line)
        else:
            unprocessed.append(line)
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