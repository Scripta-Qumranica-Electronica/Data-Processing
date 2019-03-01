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

        await Promise.all(listings.map(async listing => await savePair(listing)))

        const scroll = await pool.query(`
    INSERT INTO edition_catalog_owner (edition_catalog_id, scroll_version_id)
    SELECT DISTINCT edition_catalog_id, scroll_version_id
    FROM edition_catalog
    JOIN scroll_data USING(scroll_id)
    JOIN scroll_data_owner USING(scroll_data_id)
    JOIN scroll_version USING(scroll_version_id)
    WHERE scroll_version.user_id = 1`)
    
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