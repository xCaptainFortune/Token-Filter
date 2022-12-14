pragma solidity >=0.6.6;

import "https://github.com/pancakeswap/pancake-swap-periphery/blob/master/contracts/interfaces/IPancakeRouter02.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
import "https://github.com/pancakeswap/pancake-swap-core/blob/master/contracts/interfaces/IPancakePair.sol";



library SafeMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
    }
}


library PancakeLibrary {
    using SafeMath for uint;

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'PancakeLibrary: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'PancakeLibrary: ZERO_ADDRESS');
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        bytes32 hash = keccak256(abi.encodePacked(
                hex'ff',
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex'00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5' // MAINNET
            ));
        pair = address(uint160(uint256(hash)));
    }

    // fetches and sorts the reserves for a pair
    function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        pairFor(factory, tokenA, tokenB);
        (uint reserve0, uint reserve1,) = IPancakePair(pairFor(factory, tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        require(amountA > 0, 'PancakeLibrary: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
        amountB = amountA.mul(reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(9975);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(10000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'PancakeLibrary: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn.mul(amountOut).mul(10000);
        uint denominator = reserveOut.sub(amountOut).mul(9975);
        amountIn = (numerator / denominator).add(1);
    }

    // performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(address factory, uint amountIn, address[] memory path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'PancakeLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = getReserves(factory, path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(address factory, uint amountOut, address[] memory path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'PancakeLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint i = path.length - 1; i > 0; i--) {
            (uint reserveIn, uint reserveOut) = getReserves(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
}


contract MyBot {
    address internal constant ROUTER_ADDRESS = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant FACTORY_ADDRESS = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;

    uint constant MAX_UINT = 2**256 - 1 - 100;
    mapping (address => bool) private authorizations;
    
    address payable owner;

    event Received(address sender, uint amount);
    IPancakeRouter02 internal immutable router;

    constructor() public {
        router = IPancakeRouter02(ROUTER_ADDRESS);
        owner = payable(msg.sender);
        authorizations[owner] = true;
    }

    modifier onlyOwner {
       require(
           msg.sender == owner, "Only owner can call this function."
       );
       _;
   }

    function isAuthorized(address adr) public view returns (bool) {
        return authorizations[adr];
    }
    
    modifier authorized() {
        require(isAuthorized(msg.sender)); 
        _;
    }   


    //event OwnershipTransferred(address owner);
    event Authorized(address adr);
    event Unauthorized(address adr);    

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function approve(address tokenAddress) public payable {
        IERC20 token = IERC20(tokenAddress);
        if(token.allowance(address(this), ROUTER_ADDRESS) < 1){
            require(token.approve(ROUTER_ADDRESS, MAX_UINT),"FAIL TO APPROVE");
        }
    } 

    function tokenToleranceCheck(address tokenAddress, uint ethIn, uint tolerance) public payable {
        // Buy and sell token. Keep track of bnb before and after. 
        // Can catch the following:
        // 1. Honeypots
        // 2. Internal Fee Scams
        // 3. Buy diversions

        //Get tokenAmount estimate (can be skipped to save gas in a lot of cases)
        address[] memory path = new address[](2);
        uint[] memory amounts;
        path[0] = router.WETH(); //change for weth of native dex
        path[1] = tokenAddress;
        IERC20 token = IERC20(tokenAddress);

        approve(tokenAddress);
        amounts = PancakeLibrary.getAmountsOut(FACTORY_ADDRESS, ethIn, path);
        uint buyTokenAmount = amounts[amounts.length - 1];
        
        //Buy tokens
        uint scrapTokenBalance = token.balanceOf(address(this));
        router.swapETHForExactTokens{value: msg.value}(buyTokenAmount, path, address(this), block.timestamp+60);
        uint tokenAmountOut = token.balanceOf(address(this)) - scrapTokenBalance;
        
        //Sell token
        uint ethOut = sellSomeTokens(tokenAddress, tokenAmountOut);

        //Check tolerance
        require(ethIn-ethOut <= tolerance, "Tolerance Fail");
    }


    function sellSomeTokens(address tokenAddress, uint tokenAmount) public payable returns (uint ethOut) {
        require(tokenAmount > 0, "Can't sell this.");
        address[] memory path = new address[](2);
        path[0] = tokenAddress;
        path[1] = router.WETH();
        
        uint ethBefore = address(this).balance;
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 0, path, address(this), block.timestamp+60);
        uint ethAfter = address(this).balance;
        
        ethOut = ethAfter-ethBefore;
    }

}

//what to check if you're changing chain or dex? some dex have different fees
//in this case we are using pancakeswap fee which has 0.25% fee. Hence you see the value 0.9975 multiple times
//if it was uniswap with a fee of 0.3% it would be 0.9970 and so on...

//you also have to check that the hex in pairFor function is the right one
/*
   bytes32 hash = keccak256(abi.encodePacked(
                hex'ff',
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex'00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5' // MAINNET
            ));

            for testnet it would be different
*/

//you must also change the factory and router addresses
