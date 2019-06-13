const chalk = require('chalk')
const mariadb = require('mariadb')
const pool = mariadb.createPool({host: 'localhost', port:3307, user:'root', password:'none', database: 'SQE', connectionLimit: 2, multipleStatements: true})

const cleanDB = async () => {
    console.log(chalk.blue('Starting to clean image data.'))
    try {
        const query = `
            SET FOREIGN_KEY_CHECKS=0;
            TRUNCATE TABLE artefact;
            TRUNCATE TABLE artefact_data;
            TRUNCATE TABLE artefact_data_owner;
            TRUNCATE TABLE artefact_shape;
            TRUNCATE TABLE artefact_shape_owner;
            TRUNCATE TABLE artefact_position;
            TRUNCATE TABLE artefact_position_owner;
            TRUNCATE TABLE artefact_stack;
            TRUNCATE TABLE artefact_stack_owner;
            TRUNCATE TABLE image_catalog;
            TRUNCATE TABLE image_catalog_author;
            TRUNCATE TABLE image_to_image_map;
            TRUNCATE TABLE iaa_edition_catalog;
            TRUNCATE TABLE iaa_edition_catalog_author;
            TRUNCATE TABLE iaa_edition_catalog_to_col;
            TRUNCATE TABLE iaa_edition_catalog_to_col_confirmation;
            TRUNCATE TABLE image_to_iaa_edition_catalog;
            TRUNCATE TABLE image_to_image_map;
            TRUNCATE TABLE image_to_image_map_author;
            TRUNCATE TABLE SQE_image;
            TRUNCATE TABLE SQE_image_author;
            SET FOREIGN_KEY_CHECKS=1;
        `
        console.log(`\n`)
        console.log(chalk.yellow(query))
        await pool.query(query)
        console.log(chalk.green('Finished cleaning image data.'))
        process.exit(0)
    } catch(err) {
        console.error(chalk.red('Failed to clean image data.'))
        console.error(err)
        process.exit(1)
    }
}

cleanDB()