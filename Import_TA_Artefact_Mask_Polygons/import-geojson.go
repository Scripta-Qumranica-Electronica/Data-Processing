// This program reads in all the files in a specific folder (line 38).
// These should all be files with GeoJSON data about the coordinates
// of an artefact within the fragment image (Adiel prepares these).
// It then inputs this data into the database.

package main

import (
	"database/sql"
	"encoding/json"
	"io/ioutil"
    "path/filepath"
    "flag"
	"log"
	"strings"
    "sync"
    "time"
    "gopkg.in/cheggaaa/pb.v1"
    "os"

	//"github.com/Bronson-Brown-deVost/gosqljson"
	"fmt"
	"unicode"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB
var maxConns = 80
var connsInUse = 0
var dir string
var wg sync.WaitGroup
var err error
var failedFiles []string

var polygons struct {
	Type        string    `json:"type"`
	Coordinates [][][]int `json:"coordinates"`
}

type file struct {
    info    os.FileInfo
    path    string
}


func init() {
    dbConnPtr := flag.String("db", "root:none@tcp(localhost:3307)/SQE?charset=utf8", "the connection string settings for connection to the database")
    dataFolderPtr := flag.String("data", "./Data/No-japanese-paper-4-6-2019/", "the folder containing the data to be imported")
    flag.Parse()
    dir = *dataFolderPtr
    dbConn := *dbConnPtr
    println("The database connection string is: " + dbConn)

	db, err = sql.Open("mysql", dbConn)
	checkErr(err, "n")
	db.SetMaxOpenConns(maxConns)
    db.SetMaxIdleConns(50)
    db.SetConnMaxLifetime(time.Hour)
}

func main() {
    defer db.Close()
    println("The data folder is: " + dir)
    absPath, _ := filepath.Abs(dir)
    if _, err := os.Stat(absPath); os.IsNotExist(err) {
        println("The folder " + absPath + " does not exist.")
        os.Exit(1)
    }
    var files []file
	err := filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
        if !info.IsDir() {
            files = append(files, file{info: info, path: path})
        }
        return nil
    })
	if err != nil {
		log.Fatal(err)
	}

    // for _, f := range files {
    //     println(f.path)
    //     println(f.info.Name())
    // }

    bar := pb.StartNew(len(files))
	for _, f := range files {
        wg.Add(1)
        var file, dir = filepath.Split(f.path)
		readFile(file, dir, &wg, bar)
	}

    wg.Wait()
    bar.FinishPrint("Finished inserting records.")

    println("Creating artefact_stack entries")
    db.Query(`
    INSERT IGNORE INTO artefact_stack (artefact_A_id, artefact_B_id)
    SELECT DISTINCT as1.artefact_id, as2.artefact_id
    FROM artefact_shape as1
    JOIN SQE_image si1 ON si1.sqe_image_id = as1.sqe_image_id
    JOIN image_catalog ic1 ON ic1.image_catalog_id = si1.image_catalog_id
    AND ic1.catalog_side = 0
    JOIN image_catalog ic2 ON ic1.institution = ic2.institution
        AND ic1.catalog_number_1 = ic2.catalog_number_1
        AND ic1.catalog_number_2 = ic2.catalog_number_2
        AND ic1.catalog_side = MOD(ic2.catalog_side + 1, 2)
    JOIN SQE_image si2 ON si2.image_catalog_id = ic2.image_catalog_id
        AND si2.is_master = 1
    JOIN artefact_shape as2 ON as2.sqe_image_id = si2.sqe_image_id
        AND as2.artefact_id != as1.artefact_id
    `)

    db.Query(`
    INSERT INTO artefact_stack_owner (artefact_stack_id, edition_id, edition_editor_id)
    SELECT DISTINCT artefact_stack.artefact_stack_id, artefact_shape_owner.edition_id, artefact_shape_owner.edition_editor_id
    FROM artefact_stack
    JOIN artefact_shape ON artefact_stack.artefact_A_id = artefact_shape.artefact_shape_id
    JOIN artefact_shape_owner USING(artefact_shape_id)
    JOIN edition_editor_id USING(edition_id)
    WHERE edition_editor_id.user_id = (SELECT user_id FROM user WHERE user_name = "sqe_api")
    `)
	println("Finished inserting artefact_stack entries.")
	if len(failedFiles) > 0 {
		println("Some files failed.")
        f, err := os.Create("failed_artefact_import.txt")
        checkErr(err, "Failed to create file.")

        for _, v := range failedFiles {
            fmt.Fprintln(f, v)
            checkErr(err, v)
        }
        err = f.Close()
        checkErr(err, "Failed to close file.")
        println(len(failedFiles), " files failed to load.")
	}
}

func checkErr(err error, img string) {
	if err != nil {
		failedFiles = append(failedFiles, img)
		panic(err)
	}
}

/*
** The GeoJSON files from Tel Aviv typically need a number
** of fixes for malformed JSON.  The following catches all
** cases I ran up against.
 */
func readFile(dir string, file string, wg * sync.WaitGroup, bar *pb.ProgressBar) {
	//println("Starting: " + file)
	poly, err := ioutil.ReadFile(dir + file)
	checkErr(err, "n")
	data := string(poly)
	data = strings.Replace(data, "][", "],[", -1)
	data = strings.Replace(data, "][", "],[", -1)
	data = strings.Replace(data, "]\n	\"", "],\"", -1)
	data = strings.Replace(data, ",	]", "	]", -1)
	data = strings.Replace(data, "],	]", "	]", -1)
	err = json.Unmarshal([]byte(data), &polygons)
	checkErr(err, "n")
	processed, err := json.Marshal(polygons)
	checkErr(err, "n")
	go insertRecord(string(processed[:]), dir, file, wg, bar)
	//fmt.Printf("%s\n", processed)
}

func insertRecord(record string, dir string, filename string, wg * sync.WaitGroup, bar *pb.ProgressBar) {
    defer wg.Done()
    for connsInUse >= maxConns {
        time.Sleep(100 * time.Millisecond)
    }
    connsInUse += 1
	img := strings.Split(filename, ".json")[0]

    // Get the reference data for this imaged object (via filename without the file extension)
	rows, err := db.Query(`
SELECT SQE_image.sqe_image_id AS sqe_image_id,
	manuscript,
	edition_location_1,
	edition_location_2,
	edition.edition_id AS edition_id,
    edition_editor.edition_editor_id AS edition_editor_id,
    artefact_id
FROM SQE_image
    LEFT JOIN image_to_iaa_edition_catalog USING(image_catalog_id)
	LEFT JOIN iaa_edition_catalog USING(iaa_edition_catalog_id)
	LEFT JOIN edition USING(scroll_id)
	LEFT JOIN edition_editor USING(edition_id)
    LEFT JOIN artefact_shape USING(sqe_image_id)
WHERE REPLACE(filename, ' ', '') LIKE REPLACE("` + img + `%", ' ', '')`)
	checkErr(err, "n")
    defer rows.Close()
	var sqeID int
	var composition sql.NullString
	var loc_1 sql.NullString
	var loc_2 sql.NullString
	var editionID sql.NullInt64
	var editionEditorID sql.NullInt64
    var artefactID sql.NullInt64
	for rows.Next() {
		err = rows.Scan(&sqeID, &composition, &loc_1, &loc_2, &editionID, &editionEditorID, &artefactID)
		checkErr(err, "n")
	}

	if sqeID != 0 {
        tx, err := db.Begin()
        if err != nil {
            log.Fatal(err)
        }
        artID := artefactID.Int64
        if (!artefactID.Valid) { // If no artefact exists, create a new one
            data, err := tx.Exec(`
            INSERT INTO artefact ()
            VALUES ()`)
            checkErr(err, img)
            artID, err = data.LastInsertId()

            data, err = tx.Exec(`
            INSERT INTO artefact_shape (artefact_id, region_in_sqe_image, sqe_image_id)
                VALUES (?, ST_GeomFromGeoJSON(?), ?)
            ON DUPLICATE KEY UPDATE artefact_shape_id=LAST_INSERT_ID(artefact_shape_id)`,
                artID, record, sqeID)
            checkErr(err, img)
            var artShapeID int64
            artShapeID, err = data.LastInsertId()

            data, err = tx.Exec(`
            INSERT IGNORE INTO artefact_shape_owner (artefact_shape_id, edition_id, edition_editor_id)
                VALUES (?, ?, ?)`,
                artShapeID, editionID, editionEditorID)
            checkErr(err, img)

            data, err = tx.Exec(`
            INSERT INTO artefact_data (artefact_id, name)
                VALUES (?, ?)
            ON DUPLICATE KEY UPDATE artefact_data_id=LAST_INSERT_ID(artefact_data_id)`,
                artID, fmt.Sprintf("%s - %s - %s", composition.String, loc_1.String, loc_2.String))
            checkErr(err, img)
            var artDataID int64
            artDataID, err = data.LastInsertId()

            data, err = tx.Exec(`
            INSERT IGNORE INTO artefact_data_owner (artefact_data_id,  edition_id, edition_editor_id)
            VALUES (?, ?, ?)`,
                artDataID, editionID, editionEditorID)
            checkErr(err, img)
        } else { // Since an artefact already exists, check if it is the same as the one we are loading
            data, err := db.Query(
			`
            SELECT ST_EQUALS(region_in_sqe_image, ST_GeomFromGeoJSON(?)) AS equal, artefact_shape_id
            FROM artefact_shape
            WHERE artefact_id = ?`, record, artID)
            checkErr(err, img)
            var equal int64
            var artefact_shape_id_orig int64
            for data.Next() {
                err = data.Scan(&equal, &artefact_shape_id_orig)
                checkErr(err, "n")
            }
            // If the new polygon is different, then replace the old one, if not, then do nothing
            if (equal == 0) {
                data, err := tx.Exec(`
                INSERT INTO artefact_shape (artefact_id, region_in_sqe_image, sqe_image_id)
                    VALUES (?, ST_GeomFromGeoJSON(?), ?)
                ON DUPLICATE KEY UPDATE artefact_shape_id=LAST_INSERT_ID(artefact_shape_id)`,
                    artID, record, sqeID)
                checkErr(err, img)
                var artShapeID int64
                artShapeID, err = data.LastInsertId()
                checkErr(err, "n")
                data, err = tx.Exec(`
                UPDATE artefact_shape_owner
                SET artefact_shape_id = ?
                WHERE artefact_shape_id = ? AND edition_id = ?`,
                    artShapeID, artefact_shape_id_orig, editionID)
                checkErr(err, img)
            }
        }

        err = tx.Commit()
        if err != nil {
            log.Fatal(err)
        }
        bar.Increment()
	} else {
		failedFiles = append(failedFiles, img)
        bar.Increment()
	}
    connsInUse -= 1
}

func stripSpaces(str string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			// if the character is a space, drop it
			return -1
		}
		// else keep it in the string
		return r
	}, str)
}
