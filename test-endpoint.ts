
async function test() {
  const urls = [
    "https://api.lovable.dev/v1/chat/completions",
    "https://api.lovable.dev/v1/ai/chat/completions",
    "https://api.lovable.ai/v1/chat/completions",
    "https://api.lovable.ai/v1/ai/chat/completions"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'OPTIONS' });
      console.log(`${url}: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`${url}: Error ${e.message}`);
    }
  }
}

test();
