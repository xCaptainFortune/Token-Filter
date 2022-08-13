var _ = require('lodash');
const {ethers} = require('ethers')
var fs = require('fs');

//-------------- this is the contract that we use to fetch all pairs from a certain exchange
const UNISWAP_QUERY_ABI =  [{"inputs":[{"internalType":"contract UniswapV2Factory","name":"_uniswapFactory","type":"address"},{"internalType":"uint256","name":"_start","type":"uint256"},{"internalType":"uint256","name":"_stop","type":"uint256"}],"name":"getPairsByIndexRange","outputs":[{"internalType":"address[3][]","name":"","type":"address[3][]"}],"stateMutability":"view","type":"function"}];
const UNISWAP_BATCH_SIZE = 500;
//-------------

//------------ this is the contract info that checks for tax/honeypot 
const tpContactAddress = '0x1298E04B39C8B5D79109F2e90079122C382885Ff'
const tpContract = new ethers.utils.Interface([
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "adr",
				"type": "address"
			}
		],
		"name": "Authorized",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Received",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "adr",
				"type": "address"
			}
		],
		"name": "Unauthorized",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenAddress",
				"type": "address"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "ethIn",
				"type": "uint256"
			}
		],
		"name": "checkInternalFee",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "fee",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "adr",
				"type": "address"
			}
		],
		"name": "isAuthorized",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenAmount",
				"type": "uint256"
			}
		],
		"name": "sellSomeTokens",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "ethOut",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "ethIn",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "tolerance",
				"type": "uint256"
			}
		],
		"name": "tokenToleranceCheck",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenAddress",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "withdrawToken",
		"outputs": [
			{
				"internalType": "bool",
				"name": "res",
				"type": "bool"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
]);

const bnbReserveAddress = '0x0000000000000000000000000000000000000000'; 
//-------------

  let pool_infoo = []; 
  let tokenss =[];

  let pool_info =[];
  let tokens;

  const provider = new ethers.providers.WebSocketProvider("wss://bsc-ws-node.nariox.org:443");
  console.log("connected")




    const getPairs = async() => {
    const uniswapQuery = new ethers.Contract("0xAe197E1C310AEC1c254bCB7998cdFd64541c9eef", UNISWAP_QUERY_ABI, provider);
    console.log("connected to contract")
    for (let i = 0; i < 50000; i += UNISWAP_BATCH_SIZE) {
		//this will get the first 50 000 pairs in pancakeswap in batches of 500
		//then you should run the bot again using  for (let i = 50000; i < 100000; i += UNISWAP_BATCH_SIZE) to include the pairs from index 50 000 to 100 000
		//we cannot make a single call from i = 0  to i = 1 100 000 (total pairs on pancakeswap) as this would be way too long.
		//so we fetch 500 pairs in each loop until we get to 50 000. then we start the bot again starting from index 50 000  to 100 000 and so on...
      const pairs = (await uniswapQuery.functions.getPairsByIndexRange("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", i, i + UNISWAP_BATCH_SIZE))[0];
	//each pair item is [token1,token2,pairAddress]
	// for each pair in pairs we check whether token2 is busd or weth
      const L = tokenss.length //will be 0 in first run then 500, then 1000...
      for (let o = 0; o < pairs.length; o++) { 
        const pair = pairs[o];
		 //token1 is always the main token itself, token2 is what people use to trade the token BUSD, WBNB etc...
        let tokenAddress = pair[0]; //main token
        let pairAddr;


       //we check whether token2 (i.e pair[1]) is busd or weth because we are only focusing on pairs that contain either of these
        if(pair[1] === '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56') {//if token2 is busd...
            pairAddr = pair[2];
            if(!tokenss.includes(tokenAddress)){  //if token has never been seen before we add it to tokenss and create a new pool_infoo item
              tokenss[L+o] = tokenAddress; 
              pool_infoo[L+o] = {'tokenAddress': tokenAddress,'busdPair': pairAddr, 'wethPair': ''}
            }else{ //else if token has been seen before
              let n = _.indexOf(tokenss, tokenAddress)
              pool_infoo[n].busdPair = pairAddr;
            }

        }else if(pair[1] === '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'){ //if token2 is weth...
            pairAddr = pair[2];
            if(!tokenss.includes(tokenAddress)){
              tokenss[L+o] = tokenAddress
              pool_infoo[L+o] = {'tokenAddress': tokenAddress,'busdPair': '', 'wethPair': pairAddr}
            }else{
              let n = _.indexOf(tokenss, tokenAddress)
              pool_infoo[n].wethPair = pairAddr;
            }

        }else{
          continue;
        } 


    }
      if (pairs.length < UNISWAP_BATCH_SIZE) {
		console.log("breaking...")
        break
      }
    }

    console.log('totalPairs fetched: ' + tokenss.length)
    console.log('time to filter some shi...')
    
    for(let i = 0; i < pool_infoo.length; i++){
      try {
      if(pool_infoo[i].busdPair === '' ||  pool_infoo[i].wethPair === ''){ //this is an optional trick to ensure that there is both a busd and wbnb pair
		//if the token is missing a busd or weth pair we set the item to null so that we can eliminate it later
        tokenss[i] = null ;
        pool_infoo[i] = null;
      }else{
        continue;
      }
      }catch(err){
        continue;
      }
    }

	//if value is null we remove it from array. Note that everything is done in parallel so that the first token in tokenss corresponds to the right pool_info 
	//.filter create a new array (in this case tokens) that has been filtered
    tokens = tokenss.filter(function(value, index, arr){ 
      return value != null;
  });

  pool_info = pool_infoo.filter(function(value,index,arr){
      return value !=null;
    });


    pool_infoo.length = 0;
    tokenss.length = 0;
    


	let pool = []


	//HERE we will filter for tokens that have a TAX or HONEYPOT and then will filter again if the busd reserve is less than 1000 busd
console.log("TESTING [tokenToleranceCheck]");
    
const ethIn = ethers.utils.parseUnits("1", "ether")
//const tolerance = ethers.utils.parseUnits(data.tolerance, "ether") 

const pairABI = [
    'function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)',
    ]

for(let i = 0; i < tokens.length; i++ ) {
var processedData = tpContract.encodeFunctionData( 		//we have a 1% (0.01) fee tolerance because we're accounting for the dex Fee
    'tokenToleranceCheck', [tokens[i], ethIn, ethers.utils.parseUnits("0.01", "ether") ] //token address
);
var checkTxn = {
    from: bnbReserveAddress, 
    to: tpContactAddress,
    data: processedData,
    value: ethIn,
    gasPrice: ethers.BigNumber.from(13),
    gasLimit: ethers.BigNumber.from(6500000),           
}
   //we check token fee whitout wasting any gas: .call() only simulates a tx and we pretend to send from an address that has enough bnb (bnbReserveAddress)
try {
    await provider.call(checkTxn) //if the token has a tax or is honeypot this will throw an error
	const pairContract = new ethers.Contract(pool_info[i].busdPair, pairABI, provider);
	let reserves = await pairContract.getReserves(); //if this doesnt throw an error we proceed to check minimum reserves amount
	if(reserves._reserve1/(10**18) > 1000 ){
    pool[i] = [pool_info[i].tokenAddress,pool_info[i].busdPair,pool_info[i].wethPair]; //if enough reserves we create a pool item with [token, busdPair, wethPair] addresses
	}else{
	pool[i] = 2; //else you will see value 2 indicating that we ignored this pair because of not enough reserve
	}
} catch (error) { //if toleranceCheck fails you will see the value 1 indicating that we ignored this pair because of tax/honeypot
	pool[i] = 1;
};   

}



	const writeStream = fs.createWriteStream('filter.txt');
	const pathName = writeStream.path;
 //this will write all the filtered pairs to an filter.txt file
 //you can copy those pairs into another file called allPairs.txt and then delete everything inside filter.txt so you can run it again from 50 000 to 100 000

      
    pool.forEach(value => writeStream.write(`${JSON.stringify(value)}\n)`));
    writeStream.on('finish', () => {
       console.log(`wrote all the array data to file ${pathName}`);
    });    
    writeStream.on('error', (err) => {
        console.error(`There is an error writing the file ${pathName} => ${err}`)
    });
        writeStream.end();
    console.log(tokens.length);

  }
  getPairs();



  



