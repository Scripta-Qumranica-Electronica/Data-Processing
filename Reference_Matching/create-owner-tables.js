const mariadb = require('mariadb')
const pool = mariadb.createPool({
     host: 'localhost',
     port: 3307,
     user:'root',
     password: 'none',
     connectionLimit: 75,
     database: "SQE_DEV"
})

const createTables = async () => {
    try {
        // Create front and back edition_catalog entries for all "Unknown" images
//         await pool.query(`
// INSERT IGNORE INTO edition_catalog (manuscript, edition_side, scroll_id, comment)
// SELECT DISTINCT scroll_data.name, 0, scroll_data.scroll_id, "This is where the artefacts with absolutely no reference data are put."
// FROM scroll_data
// JOIN scroll_version_group USING(scroll_id)
// JOIN scroll_version USING(scroll_version_group_id)
// JOIN scroll_data_owner ON scroll_data_owner.scroll_data_id = scroll_data.scroll_data_id
//     AND scroll_data_owner.scroll_version_id = scroll_version.scroll_version_id
// WHERE scroll_version.user_id = 1 AND scroll_data.name = "Unknown"
//         `)
//         await pool.query(`
// INSERT IGNORE INTO edition_catalog (manuscript, edition_side, scroll_id, comment)
// SELECT DISTINCT scroll_data.name, 1, scroll_data.scroll_id, "This is where the artefacts with absolutely no reference data are put."
// FROM scroll_data
// JOIN scroll_version_group USING(scroll_id)
// JOIN scroll_version USING(scroll_version_group_id)
// JOIN scroll_data_owner ON scroll_data_owner.scroll_data_id = scroll_data.scroll_data_id
//     AND scroll_data_owner.scroll_version_id = scroll_version.scroll_version_id
// WHERE scroll_version.user_id = 1 AND scroll_data.name = "Unknown"
//         `)

        // Create all edition_catalog_owner entries
        await pool.query(`
INSERT IGNORE INTO edition_catalog_owner (edition_catalog_id, scroll_version_id)
SELECT DISTINCT edition_catalog.edition_catalog_id, scroll_version.scroll_version_id
FROM edition_catalog
JOIN scroll_version_group USING(scroll_id)
JOIN scroll_version USING(scroll_version_group_id)
        `)

        // Make image_to_edition_catalog entries for Unknown images
        await pool.query(`
INSERT IGNORE INTO image_to_edition_catalog (image_catalog_id, edition_catalog_id)
SELECT DISTINCT image_catalog.image_catalog_id,
    (SELECT DISTINCT edition_catalog.edition_catalog_id
    FROM edition_catalog
    JOIN edition_catalog_owner USING(edition_catalog_id)
    JOIN scroll_version USING(scroll_version_id)
    WHERE edition_catalog.manuscript = "Unknown"
        AND edition_catalog.edition_side = 0
        AND scroll_version.user_id = 1)
FROM image_catalog
LEFT JOIN image_to_edition_catalog USING(image_catalog_id)
WHERE image_to_edition_catalog.image_catalog_id IS NULL AND image_catalog.catalog_side = 0
        `)
        await pool.query(`
INSERT IGNORE INTO image_to_edition_catalog (image_catalog_id, edition_catalog_id)
SELECT DISTINCT image_catalog.image_catalog_id,
    (SELECT DISTINCT edition_catalog.edition_catalog_id
    FROM edition_catalog
    JOIN edition_catalog_owner USING(edition_catalog_id)
    JOIN scroll_version USING(scroll_version_id)
    WHERE edition_catalog.manuscript = "Unknown"
        AND edition_catalog.edition_side = 1
        AND scroll_version.user_id = 1)
FROM image_catalog
LEFT JOIN image_to_edition_catalog USING(image_catalog_id)
WHERE image_to_edition_catalog.image_catalog_id IS NULL AND image_catalog.catalog_side = 1
        `)

        // Create all possible image_catalog_owner entries
        await pool.query(`
INSERT IGNORE INTO image_catalog_owner (image_catalog_id, scroll_version_id)
SELECT DISTINCT image_catalog.image_catalog_id, scroll_version.scroll_version_id
FROM image_catalog
JOIN image_to_edition_catalog USING(image_catalog_id)
JOIN edition_catalog USING(edition_catalog_id)
JOIN scroll_version_group USING(scroll_id)
JOIN scroll_version USING(scroll_version_group_id)
        `)

        // Create all possible SQE_image_owner entries
        await pool.query(`
INSERT IGNORE INTO SQE_image_owner (sqe_image_id, scroll_version_id)
SELECT DISTINCT SQE_image.sqe_image_id, scroll_version.scroll_version_id
FROM SQE_image
JOIN image_to_edition_catalog USING(image_catalog_id)
JOIN edition_catalog USING(edition_catalog_id)
JOIN scroll_version_group USING(scroll_id)
JOIN scroll_version USING(scroll_version_group_id)
        `)

    } catch(err) {
        console.error(err)
        process.exit(1)
    } finally {
        process.exit(0)
    }

}

createTables()