
async function test() {
  const url = "https://api.lovable.dev/v1/ai/chat/completions";
  const apiKey = process.env['LOVABLE_API_KEY'];
  
  console.log("Testing URL:", url);
  console.log("API Key present:", !!apiKey);

  try {
    const res = await fetch(url, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5
      })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Body: ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

test();

