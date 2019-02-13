const fs = require('fs')
const mariadb = require('mariadb')
const chalk = require('chalk')
const csv=require('csvtojson')
const args = require('minimist')(process.argv.slice(2))

const defaultFilePath = './matches.csv'
if (!args.f) {
    console.warn(`If you don't provide a filename with the -f switch,
    the default will be used: '${defaultFilePath}'.`)
}
const inputFile = args.f || defaultFilePath
let count = 0

console.log(chalk.blue('Connecting to DB.  This may take a moment.'))
const pool = mariadb.createPool({
  host: 'localhost',
  port: 3307,
  user:'root',
  password: 'none',
  database: 'SQE_DEV',
  connectionLimit: 80
})

const parseListingFile = async () => {
    try {
        const listings = await csv({delimiter: 'auto'}).fromFile(inputFile)
        console.log(`Processing ${listings.length} entries.`)

        // for (let i = 0; i < listings.length; i++) {
        //     await savePair(listings[i])
        // }
        // tasks = []
        await Promise.all(listings.map(async listing => await savePair(listing)))
        // tasks.map(async task => {try{await task} catch(err) {throw err}})
        console.log(`Processed ${count} entries.`)
        process.exit(0)
    } catch(err) {
        console.error(err)
        process.exit(1)
    }
}

const savePair = async (listing) => {
    try {
        const conn = await pool.getConnection()
        await conn.query(`
        INSERT IGNORE INTO edition_catalog_to_col (edition_catalog_id, col_id)
        VALUES (?, ?)
        `, [listing.edition_catalog_id, listing.col_id])
        conn.end()
        count++
    } catch(err) {
        console.error(err)
        savePair(listing)
    }
}

parseListingFile()