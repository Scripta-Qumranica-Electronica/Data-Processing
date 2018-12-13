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
	"log"
	"strings"
    "sync"
    "time"

	//"github.com/Bronson-Brown-deVost/gosqljson"
	"fmt"
	"unicode"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB
var maxConns = 80
var connsInUse = 0
var wg sync.WaitGroup
var err error
var failedFiles []string

var polygons struct {
	Type        string    `json:"type"`
	Coordinates [][][]int `json:"coordinates"`
}

func init() {
	db, err = sql.Open("mysql", "root:none@tcp(localhost:3307)/SQE_DEV?charset=utf8")
	checkErr(err, "n")
	db.SetMaxOpenConns(maxConns)
    db.SetMaxIdleConns(50)
    db.SetConnMaxLifetime(time.Hour)
}

func main() {
    defer db.Close()
	dir := "./Data/No-japanese-paper-10-18/"
    absPath, _ := filepath.Abs(dir)
	files, err := ioutil.ReadDir(absPath)
	if err != nil {
		log.Fatal(err)
	}

	for _, f := range files {
        wg.Add(1)
		readFile(dir, f.Name(), &wg)
	}

    wg.Wait()
	println("Finished inserting records.")
	if len(failedFiles) > 0 {
		println("Some files failed.")
		for _, v := range failedFiles {
			println(fmt.Sprintf("%s", v))
		}
        println("%i files failed to load.", len(failedFiles))
	}

	// insertRecord(record, filename)
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
func readFile(dir string, file string, wg * sync.WaitGroup) {
	println("Starting: " + file)
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
	go insertRecord(string(processed[:]), dir, file, wg)
	// fmt.Printf("%s\n", processed)
}

func insertRecord(record string, dir string, filename string, wg * sync.WaitGroup) {
    defer wg.Done()
    for connsInUse >= maxConns {
        time.Sleep(100 * time.Millisecond)
    }
    connsInUse += 1
	//img := strings.Split(filename, "/")[4]
	img := strings.Split(filename, "json")[0]
	img = strings.Replace(img, " ", "", -1)
	img = img + "tif"

	rows, err := db.Query(
		`
SELECT sqe_image_id, 
	composition, 
	edition_location_1, 
	edition_location_2, 
	scroll_version_id,
    artefact_id
FROM SQE_image
    JOIN image_to_edition_catalog USING(image_catalog_id)
	JOIN edition_catalog USING(edition_catalog_id)
	JOIN scroll_version_group USING(scroll_id)
	JOIN scroll_version USING(scroll_version_group_id)
    LEFT JOIN artefact_shape ON artefact_shape.id_of_sqe_image = SQE_image.sqe_image_id
WHERE filename=?`,
		img)
	checkErr(err, "n")
    defer rows.Close()
	var sqeID int
	var composition string
	var loc_1 string
	var loc_2 string
	var scrollVerID int
    var artefactID sql.NullInt64
	for rows.Next() {
		err = rows.Scan(&sqeID, &composition, &loc_1, &loc_2, &scrollVerID, &artefactID)
		checkErr(err, "n")
	}

	if sqeID != 0 {
        tx, err := db.Begin()
        if err != nil {
            log.Fatal(err)
        }
        artID := artefactID.Int64
        if (artID == 0) {
            data, err := tx.Exec(
			`
            INSERT INTO artefact () 
            VALUES ()`)
            checkErr(err, img)
            artID, err = data.LastInsertId()
        }
        
		data, err := tx.Exec(
			`
	INSERT INTO artefact_shape (artefact_id, region_in_sqe_image, id_of_sqe_image) 
		VALUES (?, ST_GeomFromGeoJSON(?), ?)
    ON DUPLICATE KEY UPDATE artefact_shape_id=LAST_INSERT_ID(artefact_shape_id)`,
			artID, record, sqeID)
		checkErr(err, img)
        var artShapeID int64
		artShapeID, err = data.LastInsertId()

		data, err = tx.Exec(
			`
	INSERT INTO artefact_shape_owner (artefact_shape_id, scroll_version_id) 
		VALUES (?, ?)`,
			artShapeID, scrollVerID)
		checkErr(err, img)

		data, err = tx.Exec(
			`
	INSERT INTO artefact_data (artefact_id, name) 
		VALUES (?, ?) 
	ON DUPLICATE KEY UPDATE artefact_data_id=LAST_INSERT_ID(artefact_data_id)`,
			artID, fmt.Sprintf("%s - %s - %s", composition, loc_1, loc_2))
		checkErr(err, img)
		var artDataID int64
		artDataID, err = data.LastInsertId()

		data, err = tx.Exec(
			`
	INSERT INTO artefact_data_owner (artefact_data_id, scroll_version_id) 
		VALUES (?, ?)`,
			artDataID, scrollVerID)
		checkErr(err, img)

		println("Done with: " + img)
        
        err = tx.Commit()
        if err != nil {
            log.Fatal(err)
        }
	} else {
		failedFiles = append(failedFiles, img)
		println("Failed with: " + img)
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
