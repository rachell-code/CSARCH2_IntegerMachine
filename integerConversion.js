import * as helpers from './helpers.js';

/**
 * Converts a decimal number to an unsigned
 * binary.
 * 
 * @param {*} num decimal number to be converted
 * @param {*} size intended number of bits
 * @returns array representing the unsigned binary output
 */
export function convertToUnsigned(num, size) {

     if(helpers.isWithinUnsignedRange(num, size)) {
        let binaryNum = helpers.convertToBinary(num);
        helpers.appendBits(binaryNum, size);
        return binaryNum;
     } 

     return new Error('Input is outside unsigned range!');
}

/**
 * Converts a decimal number to signed
 * binary.
 * 
 * @param {*} num decimal number to be converted
 * @param {*} size intended number of bits
 * @returns array representing the signed binary output
 */
export function convertToSigned(num, size) {

   if(helpers.isWithinSignedRange(num, size)) {
      let binaryNum = helpers.convertToBinary(num);
      helpers.appendBits(binaryNum, size);
      
      return helpers.convertToTwosComplement(binaryNum);
   }

   return new Error('Input is outside signed range!');
}

/*
function signedTest(num, size) {
    try {
        console.log(`${num}, ${size}:`, convertToSigned(num, size));
    } catch(err) {
        console.log(`${num}, ${size}:`, err.message);
    }
}

function unsignedTest(num, size) {
    try {
        console.log(`${num}, ${size}:`, convertToUnsigned(num, size));
    } catch(err) {
        console.log(`${num}, ${size}:`, err.message);
    }
}
console.log("UNSIGNED")
unsignedTest(0, 4);
unsignedTest(1, 4);
unsignedTest(5, 4);
unsignedTest(10, 4);
unsignedTest(15, 4);

unsignedTest(16, 4);
unsignedTest(-1, 4);
unsignedTest(255, 8);
unsignedTest(256, 8);

console.log("SIGNED")
signedTest(0, 4);
signedTest(1, 4);
signedTest(5, 4);
signedTest(7, 4);
signedTest(15, 4);

signedTest(-1, 4);
signedTest(-2, 4);
signedTest(-5, 4);
signedTest(-16, 5);
*/

