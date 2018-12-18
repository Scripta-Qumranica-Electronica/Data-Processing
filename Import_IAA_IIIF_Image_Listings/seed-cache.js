const mariadb = require('mariadb')
const pool = mariadb.createPool({host: 'localhost', port:3307, user:'root', password:'none', database: 'SQE_DEV', connectionLimit: 85})
const axios = require('axios')

// let batchUsed = 0
// const batchSize = 20
// We will count the completed rows because this is async
let completed = 0
// We will store the results in an array to write to file at the end
let failed = []

pool.getConnection()
  .then(conn => {
    // Note with scroll_version.user_id = 1, we get only the
    // default SQE data.
    conn.query(`
    SELECT CONCAT(image_urls.proxy, image_urls.url, SQE_image.filename) AS url
    FROM SQE_image 
    JOIN image_urls USING(image_urls_id)
    WHERE image_urls_id != 0 && type = 0
    `)
      .then((rows) => {
        results = new Array(rows.length)  // Now we know how many results to expect, so instantiate the results Array

        // Get the text for each line (processLine launches an async database query)
        // for (let i = 0, row; (row = rows[i]); i++) {
        //   requestImage(row.url, i, rows.length - 1)
          
        //   // processLineWords(row, i, rows.length - 1)
        // }
        requestImage(rows, 0)
        conn.end()  // kill this connection to free up others
      })
      .catch(err => {
        //handle error
        console.error(err)
        conn.end()
        process.exit(1)
      })
      
  }).catch(err => {
    //not connected
      console.error(err)
      process.exit(1)
  })

  const requestImage = async (urls, count) => {
    // batchUsed++
    // if (batchUsed < batchSize) requestImage(urls, ++count)
    axios.get(`${urls[count].url}/full/800,/0/default.jpg`)
    .then(res => {
        completed += 1
        printProgress((completed / urls.length) * 100, urls[count].url)
        if (completed === urls.length) {
            console.log(failed)
            console.log(`Missed ${failed.length}`)
            process.exit(0)
        }
        // batchUsed--
        // if (batchUsed < batchSize) 
        requestImage(urls, ++count)
    })
    .catch(err => {
        failed.push(urls[count].url)
        //console.error(err)
        completed += 1
        printProgress((completed / urls.length) * 100, urls[count].url)
        if (completed === urls.length) {
            console.log(failed)
            console.log(`Missed ${failed.length}`)
            process.exit(0)
        }
        // if (batchUsed < batchSize) 
        requestImage(urls, ++count)
    })
}

// const requestImage = (url, count, length) => {
//     axios.get(`${url}/full/150,/0/default.jpg`)
//     .then(res => {
//         completed += 1
//         printProgress((completed / length) * 100, url)
//         if (completed === length) {
//             console.log(failed)
//             console.log(`Missed ${failed.length}`)
//             process.exit(0)
//         }
//     })
//     .catch(err => {
//         failed.push(url)
//         //console.error(err)
//         completed += 1
//         printProgress((completed / length) * 100)
//         if (completed === length) {
//             console.log(failed)
//             console.log(`Missed ${failed.length}`)
//             process.exit(0)
//         }
//     })
// }

const printProgress = (progress, url) => {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write(`${Math.round(progress * 100) / 100} % complete - ${url.replace('https://qumranica.org/image-proxy?address=', '')}`)
}