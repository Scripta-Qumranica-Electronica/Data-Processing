/**
 * This parser receives a CSV file output from the
 * IAA Menorah database and parses it for insertion
 * into the SQE database.
 */

const csv=require('csvtojson')
const args = require('minimist')(process.argv.slice(2))
const fs = require('fs').promises

// Individual listing type parsers
const parseDJD = (reference) => {
    let parsedReference
    try {
        const volPat = /DJD(\d{1,2})/
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
        parsedReference = {edition: 'DJD', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
        parsedReference = {edition: 'BE', volume: null, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
        parsedReference = {edition: 'PHLS', volume: null, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
        parsedReference = {edition: 'IEJ', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
        parsedReference = {edition: 'RB', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
        parsedReference = {edition: 'RevQ', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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

        parsedReference = {edition: 'MAS', volume: vol, plate: plate, fragment: null}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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

        parsedReference = {edition: 'MAS', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
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
            volPat = /Masada (.*)( |,) /
            volMatch = volPat.exec(reference)
            vol = volMatch && volMatch[1]
        }
            
        const platePat = /.*pl\.(.*)/
        const plateMatch = platePat.exec(reference)
        const plate = plateMatch && plateMatch[1].split(':')[0]

        let frag = null
        if (plateMatch[1].split(':')[1]) {
            const fragPat = /:(.*)/
            const fragMatch = fragPat.exec(reference)
            frag = fragMatch && fragMatch[1]
        }

        parsedReference = {edition: 'MAS', volume: vol, plate: plate, fragment: frag}
        succeeded.push(parsedReference)
    } catch(err) {
        failed.push({error: err, reference: reference})
    }
    return parsedReference
}

// Precompiled RegEx
const editions = {
    DJD: {pat: /DJD/, parse: async (reference) => parseDJD(reference)},
    BE: {pat: /BE/, parse: async (reference) => parseBE(reference)},
    IEJ: {pat: /IEJ/, parse: async (reference) => parseIEJ(reference)},
    MAS: {pat: /MAS/, parse: async (reference) => parseMAS(reference)},
    Mas: {pat: /Mas\./, parse: async (reference) => parseMas(reference)},
    Mas: {pat: /Masada/, parse: async (reference) => parseMas(reference)},
    PHLS: {pat: /PHLS/, parse: async (reference) => parsePHLS(reference)},
    RB: {pat: /RB/, parse: async (reference) => parseRB(reference)},
    RevQ: {pat: /RevQ/, parse: async (reference) => parseRevQ(reference)},
}


const defaultFilePath = './Data/Fragment on plate to DJD 27042017.csv'
let failed = []
let succeeded = []
if (!args.f) {
    console.warn(`If you don't provide a filename with the -f switch, 
    the default will be used: '${defaultFilePath}'.`)
}
const inputFile = args.f || defaultFilePath

const parseListingFile = async () => {
    try {
        const listings = await csv({delimiter: 'auto'}).fromFile(inputFile)
        listings.map(async x => await parseListing(x))
        await fs.writeFile('failed.json', JSON.stringify(failed, null, 2))
        await fs.writeFile('succeeded.json', JSON.stringify(succeeded, null, 2))
    } catch(err) {
        console.error(err)
        process.exit(1)
    }
    process.exit(0)
}

const parseListing = async (record) => {
    const reference = record['DJD- publication number']
    for (parser in editions) {
        if (editions[parser].pat.test(reference)) editions[parser].parse(reference, record)
    }
}


 
parseListingFile()