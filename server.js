
app.get('/api/proxy/video', async (req, res) => {
  try {
    const videoUrl = req.query.url;

    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    const response = await fetch(videoUrl);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch video' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});
