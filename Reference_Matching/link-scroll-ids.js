const chalk = require('chalk')
const mariadb = require('mariadb')
const pool = mariadb.createPool({host: 'localhost', port:3307, user:'root', password:'none', database: 'SQE_DEV', connectionLimit: 10})

const linkQueries = [
`UPDATE edition_catalog 
JOIN scroll_data on edition_catalog.manuscript = scroll_data.name
SET edition_catalog.scroll_id = scroll_data.scroll_id
WHERE edition_catalog.scroll_id is null;`,

`UPDATE edition_catalog
join scroll_data on name = REPLACE(manuscript, 'Mas ', 'Mas')
set edition_catalog.scroll_id = scroll_data.scroll_id
where edition_catalog.manuscript like "Mas%";`,

`UPDATE edition_catalog
join scroll_data on name = REPLACE(manuscript, 'XHev/Se', 'XHev/Se ')
set edition_catalog.scroll_id = scroll_data.scroll_id
where edition_catalog.manuscript like "%XHev/Se%";`,

`UPDATE edition_catalog
join scroll_data on name = REPLACE(manuscript, 'MUR', 'Mur. ')
set edition_catalog.scroll_id = scroll_data.scroll_id
where edition_catalog.manuscript like "MUR%";`,

`UPDATE edition_catalog
join scroll_data on name = REPLACE(manuscript, '5/6Hev ', '5/6Hev')
set edition_catalog.scroll_id = scroll_data.scroll_id
where edition_catalog.manuscript like "5/6H%";`,

`UPDATE edition_catalog 
JOIN scroll_data on REGEXP_REPLACE(edition_catalog.manuscript, "[\-][0-9]{1,5}", "")  = scroll_data.name
SET edition_catalog.scroll_id = scroll_data.scroll_id
WHERE edition_catalog.scroll_id is null;`,

`UPDATE edition_catalog 
JOIN scroll_data on REGEXP_REPLACE(REPLACE(edition_catalog.manuscript, "5/6Hev ", "5/6Hev")
, "[ ][0-9]{3,5}", "")  = scroll_data.name
SET edition_catalog.scroll_id = scroll_data.scroll_id
WHERE edition_catalog.scroll_id is null;`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "1QSb")
WHERE edition_catalog.manuscript LIKE "1Q28b%";`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "1QS")
WHERE edition_catalog.manuscript = "1Q28";`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "4Q223-224")
WHERE edition_catalog.manuscript = "4Q223" OR edition_catalog.manuscript = "4Q224";`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "XHev/Se Nab. 2")
WHERE edition_catalog.manuscript = "5/6Hev1b *103";`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "5/6Hev1b")
WHERE edition_catalog.manuscript = "XHev/Se Nab. 2 (862)";`,

`UPDATE edition_catalog
set edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "XHev/Se Nab. 5")
WHERE edition_catalog.manuscript = "XHev/Se Nab. 5 (864)";`
]

const processLinks = async () => {
    console.log(chalk.blue('Starting to create scroll links; this may take a while.'))
    try {
        for (query of linkQueries) {
            console.log(`\n`)
            console.log(chalk.yellow(query))
            await pool.query(query)
        } 
        console.log(chalk.green('Finished creating scroll links.'))
        process.exit(0)
    } catch(err) {
        console.error(chalk.red('Failed to create all scroll links.'))
        console.error(err)
        process.exit(1)
    }
}

processLinks()