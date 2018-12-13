/**
 * This parser receives a CSV file output from the
 * IAA Menorah database and parses it for insertion
 * into the SQE database.
 */

const csv=require('csvtojson')
const args = require('minimist')(process.argv.slice(2))
const fs = require('fs').promises

let diagErr

// Individual listing type parsers
const parseDJD = (reference) => {
    let parsedReference
    try {
        const volPat = /DJD(\d{1,2})/
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1]
        
        const platePat = /.*[pP][lg](\.|\/|)(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[2].split(':')[0]

        let frag = null
        if (plateMatch[2].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }
        parsedReference = {edition: 'DJD', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseBE = (reference) => {
    let parsedReference
    try {        
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1].split(':')[0]

        let frag = null
        if (plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }
        parsedReference = {edition: 'BE', volume: null, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parsePHLS = (reference) => {
    let parsedReference
    try {        
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1].split(':')[0]

        let frag = null
        if (plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }
        parsedReference = {edition: 'PHLS', volume: null, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseIEJ = (reference) => {
    let parsedReference
    try {
        const volPat = /IEJ(.*) pl./
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1]
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1].split(':')[0]

        let frag = null
        if (plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }
        parsedReference = {edition: 'IEJ', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseRB = (reference) => {
    let parsedReference
    try {
        const volPat = /RB(.*) pl./
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1]
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1].split(':')[0]

        let frag = null
        if (plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }
        parsedReference = {edition: 'RB', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseRevQ = (reference) => {
    let parsedReference
    try {
        const volPat = /RevQ(.*)( |:)/
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1].split(' ')[0]
            
        const platePat = /.*pl\.(.*):/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1]

        const fragPat = /:(.*)/
        const fragMatch = fragPat.exec(reference)
        const frag = fragMatch && fragMatch[1]
        parsedReference = {edition: 'RevQ', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseMas = (reference) => {
    let parsedReference
    try {
        const volPat = /Mas\.(.*) pl/
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1]
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1]

        parsedReference = {edition: 'MAS', volume: vol, ed_plate: plate, ed_fragment: null}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseMAS = (reference) => {
    let parsedReference
    try {
        const volPat = /MAS(\d{1,2})/
        const volMatch = volPat.exec(reference)
        const vol = volMatch && volMatch[1]
            
        const platePat = /.*p(l|g)\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[2].split(':')[0]

        let frag = null
        if (plateMatch[2].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }

        parsedReference = {edition: 'MAS', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseMasada = (reference) => {
    let parsedReference
    try {
        let volPat = /Masada(\d{1,2})/
        let volMatch = volPat.exec(reference)
        let vol = volMatch && volMatch[1]
        if (!vol) {
            volPat = /Masada (.*?)[ ,]/
            volMatch = volPat.exec(reference)
            vol = volMatch && volMatch[1]
        }
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch ? plateMatch[1].split(':')[0] : /[A-z]* [A-z,]* (.*)/.exec(reference)[1]

        let frag = null
        if (plateMatch && plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }

        parsedReference = {edition: 'MAS', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseJDS = (reference) => {
    let parsedReference
    try {
        const volPat = /JDS(\d{1,2})/
        const volMatch = volPat.exec(reference)
        const vol = (volMatch && volMatch[1]) || null
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        let plate = plateMatch && plateMatch[1].split(':')[0]
        plate = plate ? plate.split('pl.').join() : /JDS[\d{1,2}](.*)/.exec(reference)[1]

        let frag = null
        if (plateMatch && plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }

        parsedReference = {edition: 'JDS', volume: vol, ed_plate: plate, ed_fragment: frag}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

const parseTAD = (reference) => {
    let parsedReference
    try {
        parsedReference = {edition: 'TAD', volume: null, ed_plate: null, ed_fragment: null}
    } catch(err) {
        console.error(err)
    }
    return parsedReference
}

// Precompiled RegEx
const editions = {
    DJD: {pat: /DJD/, parse: (reference) => parseDJD(reference)},
    BE: {pat: /BE/, parse: (reference) => parseBE(reference)},
    IEJ: {pat: /IEJ/, parse: (reference) => parseIEJ(reference)},
    JDS: {pat: /JDS/, parse: (reference) => parseJDS(reference)},
    MAS: {pat: /MAS/, parse: (reference) => parseMAS(reference)},
    Mas: {pat: /Mas\./, parse: (reference) => parseMas(reference)},
    Masada: {pat: /Masada/, parse: (reference) => parseMasada(reference)},
    PHLS: {pat: /PHLS/, parse: (reference) => parsePHLS(reference)},
    RB: {pat: /RB/, parse: (reference) => parseRB(reference)},
    RevQ: {pat: /RevQ/, parse: (reference) => parseRevQ(reference)},
    TAD: {pat: /Textbook of Aramaic, Hebrew and Nabataean Document/, parse: (reference) => parseTAD(reference)}
}


const defaultFilePath = './Data/Fragment-on-plate-to-DJD-27042017-cleaned.tsv'
let failed = []
let writeQueue = []
if (!args.f) {
    console.warn(`If you don't provide a filename with the -f switch, 
    the default will be used: '${defaultFilePath}'.`)
}
const inputFile = args.f || defaultFilePath

const parseListingFile = async () => {
    try {
        const listings = await csv({delimiter: 'auto'}).fromFile(inputFile)
        const tasks = []
        listings.map(async listing => tasks.push(parseListing(listing)))
        tasks.map(async task => {try{await task} catch(err) {console.error(err)}})
        await fs.writeFile('write.json', JSON.stringify(writeQueue, null, 2))
        await fs.writeFile('failed.json', JSON.stringify(failed, null, 2))
        await fs.writeFile('failed-patterns.json', JSON.stringify(failed.reduce((x, y) => {
            x[y["DJD- publication number"]] = `${y["Manuscript number"]}: IAA plate ${y["Plate number- IAA inventory"]}, IAA fragment ${y["Fragment number (on IAA plate)"]}.`
            return x;
        }, {}), null, 2))
    } catch(err) {
        console.error(err)
        process.exit(1)
    }

    console.error(`Diagnostin error: ${diagErr}`)
    console.log(`\nFinished processing references.
    Succeeded in parsing ${writeQueue.length} references, failed to parse ${failed.length} references.`)
    process.exit(0)
}

const parseListing = async (record) => {
    const reference = record['DJD- publication number']
    return new Promise((resolve, reject) => {
        try {
            let parsedReference
            for (parser in editions) {
                if (editions[parser].pat.test(reference)) {
                    parsedReference = editions[parser].parse(reference, record)
                }
            }
            if (!parsedReference) failed.push(record)
            else {
                writeQueue.push({
                    manuscript: record['Manuscript number'],
                    plate: record['Plate number- IAA inventory'],
                    fragment: record['Fragment number (on IAA plate)'],
                    ...parsedReference
                })
            }
            resolve()
        } catch(err) {
            console.error(err)
            reject()
        }
    })
}
 
parseListingFile()