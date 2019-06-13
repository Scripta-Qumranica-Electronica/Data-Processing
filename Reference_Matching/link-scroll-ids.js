const chalk = require('chalk')
const mariadb = require('mariadb')
const pool = mariadb.createPool({host: 'localhost', port:3307, user:'root', password:'none', database: 'SQE_DEV', connectionLimit: 10})

const linkQueries = [
`UPDATE iaa_edition_catalog
SET iaa_edition_catalog.scroll_id = null
WHERE iaa_edition_catalog.scroll_id = 0;`,

`UPDATE iaa_edition_catalog
JOIN scroll_data on iaa_edition_catalog.manuscript = scroll_data.name
SET iaa_edition_catalog.scroll_id = scroll_data.scroll_id
WHERE iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
join scroll_data on name = REPLACE(manuscript, 'Mas ', 'Mas')
set iaa_edition_catalog.scroll_id = scroll_data.scroll_id
where iaa_edition_catalog.manuscript like "Mas%" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
join scroll_data on name = REPLACE(manuscript, 'XHev/Se', 'XHev/Se ')
set iaa_edition_catalog.scroll_id = scroll_data.scroll_id
where iaa_edition_catalog.manuscript like "%XHev/Se%" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
join scroll_data on name = REPLACE(manuscript, 'MUR', 'Mur. ')
set iaa_edition_catalog.scroll_id = scroll_data.scroll_id
where iaa_edition_catalog.manuscript like "MUR%" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
join scroll_data on name = REPLACE(manuscript, '5/6Hev ', '5/6Hev')
set iaa_edition_catalog.scroll_id = scroll_data.scroll_id
where iaa_edition_catalog.manuscript like "5/6H%" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
join scroll_data on name = REPLACE(manuscript, 'WS', 'Sdeir')
set iaa_edition_catalog.scroll_id = scroll_data.scroll_id
where iaa_edition_catalog.manuscript like "WS%" AND iaa_edition_catalog.scroll_id is NULL;`,

`UPDATE iaa_edition_catalog
JOIN scroll_data on REGEXP_REPLACE(edition_catalog.manuscript, "[\-][0-9]{1,5}", "")  = scroll_data.name
SET iaa_edition_catalog.scroll_id = scroll_data.scroll_id
WHERE iaa_edition_catalog.scroll_id is null AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
JOIN scroll_data on REGEXP_REPLACE(REPLACE(edition_catalog.manuscript, "5/6Hev ", "5/6Hev")
, "[ ][0-9]{3,5}", "")  = scroll_data.name
SET iaa_edition_catalog.scroll_id = scroll_data.scroll_id
WHERE iaa_edition_catalog.scroll_id is null;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "1QSb")
WHERE iaa_edition_catalog.manuscript LIKE "1Q28b%" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "1QS")
WHERE iaa_edition_catalog.manuscript = "1Q28" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "4Q223-224")
WHERE (edition_catalog.manuscript = "4Q223" OR iaa_edition_catalog.manuscript = "4Q224") AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "XHev/Se Nab. 2")
WHERE iaa_edition_catalog.manuscript = "5/6Hev1b *103" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "5/6Hev1b")
WHERE iaa_edition_catalog.manuscript = "XHev/Se Nab. 2 (862)" AND iaa_edition_catalog.scroll_id IS NULL;`,

`UPDATE iaa_edition_catalog
set iaa_edition_catalog.scroll_id = (SELECT scroll_id FROM scroll_data WHERE name = "XHev/Se Nab. 5")
WHERE iaa_edition_catalog.manuscript = "XHev/Se Nab. 5 (864)" AND iaa_edition_catalog.scroll_id IS NULL;`,

`DROP PROCEDURE IF EXISTS update_comps;`,
`CREATE PROCEDURE update_comps()
BEGIN
DECLARE comp VARCHAR(128);
DECLARE done INT DEFAULT 0;
DECLARE cur CURSOR FOR
    SELECT DISTINCT manuscript
    FROM iaa_edition_catalog
    WHERE scroll_id is NULL;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
OPEN cur;
read_loop: LOOP

    FETCH cur INTO comp;
    IF done THEN
        LEAVE read_loop;
    END IF;

    insert into scroll (scroll_id) values (null);
    SET @scroll_id = LAST_INSERT_ID();
    insert into scroll_data (name, scroll_id) values (comp, @scroll_id) on duplicate key update scroll_data_id = LAST_INSERT_ID(scroll_data_id);
    SET @scroll_data_id = LAST_INSERT_ID();
    insert into edition (scroll_id, locked) values (@scroll_id, 1) on duplicate key update edition_id = LAST_INSERT_ID(edition_id);
    SET @edition_id = LAST_INSERT_ID();
    insert into edition_editor (user_id, edition_id) values (1, @edition_id) on duplicate key update edition_editor_id = LAST_INSERT_ID(edition_editor_id);
    set @edition_editor_id = LAST_INSERT_ID();
    insert ignore into scroll_data_owner (scroll_data_id, edition_id, edition_editor_id) values (@scroll_data_id, @edition_id, @edition_editor_id);
    update iaa_edition_catalog set scroll_id = @scroll_id where manuscript = comp and scroll_id is NULL;

END LOOP;
CLOSE cur;
END;`,
`call update_comps();`,
`DROP PROCEDURE IF EXISTS update_comps;`,
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