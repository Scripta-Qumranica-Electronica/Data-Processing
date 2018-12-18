/**
 * This script reads all the names from edition_catalog (the IAA's catalog) 
 * and from scroll_data + col_data (QWB's catalog).  It uses these data to
 * match the names in the two catalogs and create a csv output that can be
 * used to correlate each image with its corresponding text transcription
 * in the database.  The output file is called, QWB_IAA-cols.csv.  On the 
 * last run this parser made about 14,000 matches.
 * 
 * It outputs two other files: QWB_cols-discrete.json, and IAA-discrete.json.
 * These files can be used for debugging to see how well the parser was able
 * to break the joins and difficult names into discrete entities.
 */

const fs = require('fs')
const toCSV = require('array-to-csv')
const mariadb = require('mariadb')
const romanNumeralToDecimal = require('roman-numeral-to-decimal')
const chalk = require('chalk')

let textColumns = {}
let imageColumns = {}
let matches = []
let unmatched = []
const lowerRoman = / m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})/gm
const num = /^\d+$/m
const numPlusLetter = /^(\d{1,5})?([a-zA-Z]{1,2})$/m
const lowerCaseLetter = /([a-zA-Z])/m
const startLCLetter = /^([a-z]{1,2})/m
const numberRange = /(\d{1,5})_(\d{1,5})/m
const letterRange = /(\d{1,5})?([a-zA-Z]{1,2})_([a-zA-Z]{1,5})/m
const parens = /\(.*\)/m
const wrong1 = /\(.*t/m
const wrong2 = /\(.*g/m

console.log(chalk.blue('Connecting to DB.  This may take a moment.'))
const p = mariadb.createPool({
  host: 'localhost',
  port: 3307,
  user:'root', 
  password: 'none',
  database: 'SQE_DEV',
  connectionLimit: 80
})

const getTextCols = pool => {
  return new Promise (resolve => {
    pool.getConnection()
    .then(conn => {
      conn.query(`SELECT scroll_to_col.scroll_id as scroll_id, col_data.col_id as col_id, col_data.name as name
      FROM col_data
      JOIN scroll_to_col USING(col_id)`)
      .then((rows) => {
        for (let i = 0, row; (row = rows[i]); i++) {
          if (textColumns[row.scroll_id]) {
            textColumns[row.scroll_id].push({[row.col_id]: row.name})
          } else {
            textColumns[row.scroll_id] = [{[row.col_id]: row.name}]
          }
        }
        resolve(conn)
      })
    })
    .catch(() => {
      resolve(getTextCols(pool))
    })
  })
}

const getImageCols = pool => {
  return new Promise (resolve => {
    pool.getConnection()
    .then(conn => {
      conn.query(`SELECT DISTINCT scroll_id, edition_catalog_id as ed_id, edition_location_1 as loc1, edition_location_2 as loc2
      FROM edition_catalog WHERE edition_location_2 IS NOT NULL`)
      .then((rows) => {
        for (let i = 0, row; (row = rows[i]); i++) {
          if (imageColumns[row.scroll_id]) {
            imageColumns[row.scroll_id].push({ed_id: row.ed_id, loc1: row.loc1, loc2: row.loc2})
          } else {
            imageColumns[row.scroll_id] = [{ed_id: row.ed_id, loc1: row.loc1, loc2: row.loc2}]
          }
        }
        resolve(conn)
      })
    })
    .catch(() => {
      resolve(getImageCols(pool, scroll_id))
    })
  })
}

// See https://stackoverflow.com/questions/12376870/create-an-array-of-characters-from-specified-range
const alphaRange = (first, last) => {
  const a = first.charCodeAt(0)
  const b = last.charCodeAt(0) + 1
  return Array.apply(null, {length: Math.abs(b - a)})
    .map(function (x,i) { return String.fromCharCode(Math.min(a, b) + i) })
}

const numRange = (first, last) => {
  return Array.apply(null, {length: Math.abs(last - first) + 1})
    .map(function (x,i) { return (Math.min(first, last) + i).toString() })
}

const multiDimensionalUnique = (arr) => {
  var uniques = [];
  var itemsFound = {};
  for(var i = 0, l = arr.length; i < l; i++) {
      var stringified = JSON.stringify(arr[i]);
      if(itemsFound[stringified]) { continue; }
      uniques.push(arr[i]);
      itemsFound[stringified] = true;
  }
  return uniques;
}

getTextCols(p)
.then(conn1 => {
  conn1.end()
  // Make discrete references for text
  for (const scroll_id in textColumns) {
    for (let i = 0, textColumn; (textColumn = textColumns[scroll_id][i]); i++) {
      for (let col_id in textColumn) {
        if (textColumn[col_id].indexOf('frg.') > -1) {
          let name = textColumn[col_id].replace('frg. ', '').replace(lowerRoman, '')
          let individalFrags = []
          const addedFrags = name.split('+')
          addedFrags.forEach(addedFrag => {
            let foundNumRange = false
            let foundLetterRange = false
            if (numberRange.test(addedFrag)) {
              foundNumRange = true
              const [full, start, end] = numberRange.exec(addedFrag)
              const numbers = numRange(start, end)
              individalFrags = [...individalFrags, ...numbers]
            }
            if (letterRange.test(addedFrag)) {
              foundLetterRange = true
              const [full, frgNum, start, end] =  addedFrag.match(letterRange)
              const numbers = alphaRange(start, end)
              individalFrags = [...individalFrags, ...numbers.map(x => (frgNum ? frgNum : '') + x)]
            }
            if (!foundNumRange && !foundLetterRange) individalFrags.push(addedFrag)
            textColumn.frg = individalFrags
            textColumn.col_id = col_id
          })
        } else {
          let name = textColumn[col_id].replace('col. ', '').replace(lowerRoman, '')
          let individalFrags = []
          const addedFrags = name.split('+')
          addedFrags.forEach(addedFrag => {
            if (letterRange.test(addedFrag)) {
              const [full, colNum, start, end] =  addedFrag.match(letterRange)
              const numbers = alphaRange(start, end)
              individalFrags = [...individalFrags, ...numbers.map(x => x)]
              textColumn.col = colNum
            } else if (numPlusLetter.test(addedFrag)) {
              const [full, colNum, frgNum] =  addedFrag.match(numPlusLetter)
              individalFrags = [...individalFrags, frgNum]
              textColumn.col = colNum
            } else {
              textColumn.col = addedFrag
            }
          })
          textColumn.frg = [...individalFrags]
          textColumn.col_id = col_id
        }
      }
    }
  }
  //Output the textColumn object.
  fs.writeFile('QWB_cols-discrete.json', JSON.stringify(textColumns, null, 2), (err) => {  
      // throws an error, you could also catch it here
      if (err) throw err;

      // success case, the file was saved
      console.log('JSON file saved!')
  })

  getImageCols(p)
  .then(conn2 => {
    conn2.end()
    
    // Make discrete references for image  
    for (const scroll_id in imageColumns) {
      for (const column of imageColumns[scroll_id]) {
        if (column.loc1 !== 'null' && column.loc2 !== 'null'){
          column.col = romanNumeralToDecimal(column.loc1)
          column.loc2 = column.loc2.replace(parens, '').replace(' ', '')
          column.loc2 = column.loc2.replace(wrong1, '')
          column.loc2 = column.loc2.replace(wrong2, '')
          if (num.test(column.loc2)) column.frg = [column.loc2]
          else if (column.loc2.indexOf('+') > -1) {
            column.frg = column.loc2.split('+')
          }
          else if (column.loc2.indexOf(',') > -1) {
            column.frg = column.loc2.split(',')
          }
          else if (startLCLetter.test(column.loc2)) {
            column.frg = [column.loc2]
            // column.col = romanNumeralToDecimal(column.loc1)
          }
          else if (numPlusLetter.test(column.loc2)) column.frg = [column.loc2]
          else if (/(\d{1,5})-(\d{1,5})/m.test(column.loc2)) {
            const [full, start, end] =  column.loc2.match(/(\d{1,5})-(\d{1,5})/m)
            const numbers = numRange(start, end)
            column.frg = numbers
          }
          for (let fragment in column.frg) {
            fragment = fragment.replace(parens, '').replace(' ', '')
          }
        }
      }
    }
    //Output the textColumn object.
    fs.writeFile('IAA-discrete.json', JSON.stringify(imageColumns, null, 2), (err) => {  
      // throws an error, you could also catch it here
      if (err) throw err;

      // success case, the file was saved
      console.log('JSON file saved!')
  })

    //match text to image references
    for (const scroll_id in textColumns) {
      for (const col_id in textColumns[scroll_id]) {
        if (textColumns[scroll_id][col_id].frg && !textColumns[scroll_id][col_id].col) {
          for (const txtFrg of textColumns[scroll_id][col_id].frg) {
            if (imageColumns[scroll_id]) {
              for (const imgFrg of imageColumns[scroll_id]) {
                if (imgFrg.frg && imgFrg.frg.indexOf(txtFrg) > -1) {
                  matches.push([textColumns[scroll_id][col_id].col_id, imgFrg.ed_id])
                }
              }
            }
          }
        } else if (!textColumns[scroll_id][col_id].frg && textColumns[scroll_id][col_id].col) {
          // Maybe write some more code to match straight columns
        } else {
          for (const txtFrg of textColumns[scroll_id][col_id].frg) {
            let matched = false
            if (imageColumns[scroll_id]) {
              for (const imgFrg of imageColumns[scroll_id].filter(img => img.col && img.col.toString() === textColumns[scroll_id][col_id].col)) {
                if (imgFrg.frg &&
                    imgFrg.frg.indexOf(txtFrg) > -1
                ) {
                  matched = true
                  matches.push([textColumns[scroll_id][col_id].col_id, imgFrg.ed_id])
                  // break
                }
              }
              // if (!matched) { // This is a catch all.
              //   for (const imgFrg of imageColumns[scroll_id]) {
              //     if (imgFrg.frg && imgFrg.frg.indexOf(txtFrg) > -1) {
              //       matches.push([textColumns[scroll_id][col_id].col_id, imgFrg.ed_id])
              //     }
              //   }
              // }
            }
          }
        }
      }
    }

    matches = multiDimensionalUnique(matches)
    console.log(chalk.green(`Found ${matches.length} possible matches.`)) 
    const csvString = toCSV([
      ['col_id', 'edition_catalog_id'],
      ...matches
    ])
    fs.writeFile('QWB_IAA-cols.csv', csvString, (err) => {  
        // throws an error, you could also catch it here
        if (err) throw err;
    
        // success case, the file was saved
        console.log('CSV file saved!')
        process.exit(0)
    })
  })
})