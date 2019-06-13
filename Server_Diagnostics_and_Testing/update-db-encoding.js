const mariadb = require('mariadb')
const pool = mariadb.createPool({
     host: 'localhost',
     port: 3307,
     user:'root',
     password: 'none',
     connectionLimit: 75,
     database: "SQE",
})

const update = async () => {
    const schema = 'SQE'
    try {
        const tables = await pool.query(`
SELECT DISTINCT
    CONCAT("ALTER TABLE \`", TABLE_NAME,"\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;") as queries
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA=?
AND TABLE_TYPE="BASE TABLE"
            `, [schema])
        tables.map(async x => {
            await pool.query(x.queries)
        })

        const cols = await pool.query(`
SELECT DISTINCT
    CONCAT("ALTER TABLE \`", C.TABLE_NAME, "\` CHANGE \`", C.COLUMN_NAME, "\` \`", C.COLUMN_NAME, "\` ", C.COLUMN_TYPE, " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;") as queries
FROM INFORMATION_SCHEMA.COLUMNS as C
    LEFT JOIN INFORMATION_SCHEMA.TABLES as T
        ON C.TABLE_NAME = T.TABLE_NAME
WHERE C.COLLATION_NAME is not null
    AND C.TABLE_SCHEMA=?
    AND T.TABLE_TYPE="BASE TABLE"
            `, [schema])
        cols.map(async x => {
            await pool.query(x.queries)
        })

        const views = await pool.query(`
SELECT DISTINCT
    CONCAT("CREATE OR REPLACE VIEW ", V.TABLE_NAME, " AS ", V.VIEW_DEFINITION, ";") as queries
FROM INFORMATION_SCHEMA.VIEWS as V
    LEFT JOIN INFORMATION_SCHEMA.TABLES as T
        ON V.TABLE_NAME = T.TABLE_NAME
WHERE V.TABLE_SCHEMA=?
    AND T.TABLE_TYPE="VIEW"
            `, [schema])
        views.map(async x => {
            await pool.query(x.queries)
        })
        process.exit(0)
    } catch(err) {
        console.error(err)
    }

}

update()