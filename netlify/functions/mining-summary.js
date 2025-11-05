exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Simple mock data for testing
    const data = {
      totalBitcoinMined: 19750000,
      remainingBitcoin: 1250000,
      dailyBitcoinMined: "900.00",
      percentageMined: "94.05",
      estimatedDaysUntilAllMined: 1388,
      estimatedYearsUntilAllMined: "3.8",
      currentBlockReward: 6.25,
      nextHalvingBlock: 840000,
      timestamp: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};