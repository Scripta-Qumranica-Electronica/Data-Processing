const fs = require('fs')
const toCSV = require('array-to-csv')
// const romanNumeralToDecimal = require('roman-numeral-to-decimal')
const toRoman = require('roman-numerals').toRoman
const chalk = require('chalk')

const qwb = require('./QWB_cols-discrete.json')
const iaa = require('./IAA-discrete.json')

let matches = []
let failed = []

const processMatches = () => {
    for (scrollID in qwb) {
        if (iaa[scrollID]) {
            for (colName of qwb[scrollID]) {
                if (colName.frg.length > 0) {
                    for (frg of colName.frg) {
                        let tempMatch = []
                        if (iaa[scrollID].frg[frg]) tempMatch.push(...iaa[scrollID].frg[frg])
                        //Match by scroll col doesn't appear to be working
                        if (tempMatch.length > 2 && colName.col && !isNaN(colName.col) && iaa[scrollID][toRoman(~~colName.col)]) {
                            tempMatch = tempMatch.filter(value => -1 !== iaa[scrollID][toRoman(~~colName.col)].indexOf(value))
                        }
                        if (tempMatch.length === 2) matches.push(...tempMatch.map(x => [x, ~~colName.col_id]))
                        else failed.push({scroll_id: scrollID, col_id: colName.col_id, col_name: colName[colName.col], frg: frg})
                    }
                } else { //Match by scroll col doesn't appear to be working
                    if (!isNaN(colName.col) && iaa[scrollID][toRoman(~~colName.col)]) matches.push(...iaa[scrollID][toRoman(~~colName.col)].map(x => [x, ~~colName.col_id]))
                    else failed.push({scroll_id: scrollID, col_id: colName.col_id, col_name: colName[colName.col]})
                }
            }
        } else failed.push({scroll_id: scrollID})
    }
    const matchLength = matches.length
    matches = toCSV([
      ['edition_catalog_id', 'col_id'],
      ...matches
    ])
    fs.writeFile('matches.csv', matches, (err) => {  
        // throws an error, you could also catch it here
        if (err) throw err;

        // success case, the file was saved
        console.log(chalk.green('matches.csv file saved!'))
        fs.writeFile('failed.json', JSON.stringify(failed, null, 2), (err) => {  
            // throws an error, you could also catch it here
            if (err) throw err;

            // success case, the file was saved
            console.log(chalk.green('failed.json file saved!'))
            console.log(chalk.yellow(`${matchLength} matches, ${failed.length} failed.`))
            process.exit(0)
        })
    })
}

processMatches()