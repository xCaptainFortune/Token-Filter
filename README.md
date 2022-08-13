# Token-Filter

A pratical example on how to perform multiple type of filters on millions of pairs. 
The goal of this repo is to be used as a low barrier of entry reference source code for aspiring new searchers (hence, JavaScript). 

This bot contains:
- filtering pairs by tokens present. You can filter for pairs that have a busd/wbnb/usdc/dai pool for a certain token and even require that all of them/one of them/two of them be present by slightly modifying the code. I was writing an arbitrage bot that went from eth -> token -> usdc and so needed to check that an existing token had both an eth and usdc pool otherwise I would discard it from my tokens-to-arb list.
- filtering pairs by TAX/HONEYPOT/BUY DIVERSION. After filtering pairs by tokens present, this bot filters tokens that are not worth frontrunning/arbing over. Mainly those for which you lose a certain % of your trade after buying then selling. You can choose your fee tolerance accordingly, 1%, 2%, 5% etc
- filtering pairs by Reserves amount. You might not want to arb over pairs that have too little reserves as you will suffer from too much slippage and it is better if you ignore them. In this bot I filtered tokens that had less than 1000 busd in their token/BUSD Reserves. 

After all filtering is done, the final array of filtered pools ([tokenAddr, pair1Addr, pair2Addr], [...],[...],...)
is printed into another file. I can then proceed to create either an array, structure, hashmap of all those items in whichever way is convenient for my arb bot. The nice thing is that this will be hardcoded into the bot instead of it being fetched at runtime.
Too many people try to fetch the pairs and create their database inside their arbitrage bot at runtime. Having everything hardcoded beforehand is a much better alternative.


The code works straight ahead on BSC mainnet since the 2 necessary contracts are already deployed. You can go ahead and try the bot. Even though this bot simulates buy and selling it does not use any gas! Everything is explained inside the pair.js file

UniswapFlashQuery.sol is the contract that we use to fetch all pairs from any DEX  

toleranceCheck.sol is the contract that we use to filter tokens that have a TAX/HoneyPot by simulating buy and sell.

You'll have to make a few changes before deploying these contracts to other chains. These are all pretty simple and obvious so i'll let you check this.

ENJOY !
