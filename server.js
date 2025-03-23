const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// シンプルなヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// サーバーを起動
app.listen(PORT, () => {
  console.log(`監視用サーバーが起動しました: ポート ${PORT}`);
});
