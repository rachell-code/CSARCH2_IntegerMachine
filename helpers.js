/**
 * Converts a POSITIVE decimal number into binary with 
 * the exact number of bits. 
 * 
 * @param {*} num positive decimal number input
 * @returns array representing the binary output
 */
export function convertToBinary(num) {
   let binaryOutput = [];
   let binaryStack = [];
   let quotient = Math.abs(num);
   let remainder = 0;

   while(quotient >= 2){
        remainder = quotient % 2;
        binaryStack.push(remainder);

        if(quotient >= 2) {
            quotient = Math.floor(quotient/2);
        }
   }

   binaryStack.push(quotient);

   while(binaryStack.length > 0) {
        binaryOutput.push(binaryStack.pop());
   }

   return binaryOutput;
}

/**
 * Appends 0's to the given binary number according to
 * the size.
 * 
 * @param {*} binaryNum array representing the binary
 * input to be appended
 * @param {*} size the intended number of bits
 */
export function appendBits(binaryNum, size) {

     while(binaryNum.length < size) {
          binaryNum.unshift(0);
     }

}

/**
 * Converts a valid binary number to twos complement.
 * 
 * 
 * @param {*} binaryNum array representing the binary input
 * @returns array representing the twos complement output
 */
export function convertToTwosComplement(binaryNum) {
    let twosComplement = [];
    let binaryStack = [...binaryNum]
    let oneFlag = false;
    let oneIndex = 999;
     
     if(!binaryNum.includes(1)) {
          return binaryNum;
     }

     //get the index of the least significant '1' bit
     while(binaryStack.length > 0 && oneFlag === false) {
          if(binaryStack.pop() === 1) {
               oneFlag = true
               oneIndex = binaryStack.length
          }
     }

     //get ones complement until it reaches the last '1' bit (oneIndex)
     let i = 0;
     while(i != oneIndex && oneFlag === true) {
          if(binaryNum[i] === 1) {
               twosComplement.push(0);
          } else {
               twosComplement.push(1);
          }

          i++;
     }
     //copy remaining bits
     while (i < binaryNum.length) {
          twosComplement.push(binaryNum[i]);
          i++;
     }

     return twosComplement;
}

/**
 * Checks if the inputted decimal number is 
 * within the SIGNED range of the given size
 * 
 * 
 * @param {*} num decimal number
 * @param {*} size number of intended bits
 * @returns true if it is within range false if not
 */
export function isWithinSignedRange(num, size) {
     const min = -(2 ** (size-1))
     const max = 2 ** (size - 1);

     if(num >= min && num <= max) {
          return true;
     }
     return false;
}

/**
 * Checks if the inputted decimal number is 
 * within the UNSIGNED range of the given size
 * 
 * 
 * @param {*} num decimal number
 * @param {*} size number of intended bits
 * @returns true if it is within range false if not
 */
export function isWithinUnsignedRange(num, size) {
    const min = 0;
    const max = (2 ** size) - 1;

    if(num >= min && num <= max) {
        return true;
     } 
    return false;
}


