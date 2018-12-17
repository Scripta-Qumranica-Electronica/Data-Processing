const editions = require('./parsers.js').editions

const hasPlus = /\+/
const hasAmp = /&/
const hasComma = /,/
const hasSemi = /\;/
const hasPl = /pl/
const hasDJD = /DJD/

const digitOnly = /^[\d]{1,3}$/
const digitLetter = /^([\d]{1,3})[A-z]{1,5}$/
const letterOnly = /^[A-z]{1,5}$/

exports.expander = (record) => {
    let newRecords = []
    if (record.ed_fragment && record.ed_fragment.indexOf(';') > -1){
    }
    if (hasSemi.test(record.ed_fragment)) {
        const fragments = record.ed_fragment.split(';')
        let splits = 0
        fragments.map(ref => {
            ref = ref.trim() 
            const newRef = splits === 0 ? {...record, ed_fragment: ref} : editions['DJD'].parse(ref)
            if (newRef) {
                splits++
                newRefs = exports.expander(newRef)
                newRecords.push(...newRefs)
            }
        })
        if (splits === 0 || splits !== fragments.length) newRecords.push(record)
    } else if (hasDJD.test(record.ed_fragment)) {
        const fragments = record.ed_fragment.split('DJD')
        let splits = 0
        fragments.map(ref => {
            ref = ref.trim() 
            const newRef = splits === 0 ? {...record, ed_fragment: ref} : editions['DJD'].parse('DJD' + ref)
            if (newRef) {
                splits++
                newRefs = exports.expander(newRef)
                newRecords.push(...newRefs)
            }
        })
        if (splits === 0 || splits !== fragments.length) newRecords.push(record)
    } else if (hasPl.test(record.ed_fragment)) {
        newRecords.push(record)
    } else if (hasPlus.test(record.ed_fragment)) {
        const fragments = record.ed_fragment.split('+')
        let currentDigit
        let splits = 0
        fragments.map(ref => {
            ref = ref.trim()
            if (digitOnly.test(ref)) {
                splits++
                currentDigit = ref
                newRecords.push({...record, ed_fragment: ref})
            } else if (letterOnly.test(ref)) {
                splits++
                newRecords.push({...record, ed_fragment: `${currentDigit ? currentDigit : ''}${ref}`})
            } else if (digitLetter.test(ref)) {
                splits++
                currentDigit = digitLetter.exec(ref)[1]
                newRecords.push({...record, ed_fragment: ref})
            }
        })
        if (splits === 0 || splits !== fragments.length) newRecords.push(record)
    } else if (hasAmp.test(record.ed_fragment)) {
        const fragments = record.ed_fragment.split('&')
        let currentDigit
        let splits = 0
        fragments.map(ref => {
            ref = ref.trim()
            if (digitOnly.test(ref)) {
                splits++
                currentDigit = ref
                newRecords.push({...record, ed_fragment: ref})
            } else if (letterOnly.test(ref)) {
                splits++
                newRecords.push({...record, ed_fragment: `${currentDigit ? currentDigit : ''}${ref}`})
            } else if (digitLetter.test(ref)) {
                splits++
                currentDigit = digitLetter.exec(ref)[1]
                newRecords.push({...record, ed_fragment: ref})
            }
        })
        if (splits === 0 || splits !== fragments.length) newRecords.push(record)
    } else if (hasComma.test(record.ed_fragment)) {
        const fragments = record.ed_fragment.split(',')
        let currentDigit
        let splits = 0
        fragments.map(ref => {
            ref = ref.trim()
            if (digitOnly.test(ref)) {
                splits++
                currentDigit = ref
                newRecords.push({...record, ed_fragment: ref})
            } else if (letterOnly.test(ref)) {
                splits++
                newRecords.push({...record, ed_fragment: `${currentDigit ? currentDigit : ''}${ref}`})
            } else if (digitLetter.test(ref)) {
                splits++
                currentDigit = digitLetter.exec(ref)[1]
                newRecords.push({...record, ed_fragment: ref})
            }
        })
        if (splits === 0 || splits !== fragments.length) newRecords.push(record)
    } else {
        newRecords.push(record)
    }
    return newRecords
}