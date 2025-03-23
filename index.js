// Discord.jsの必要なクラスをインポート
//require('web-streams-polyfill/polyfill');

const {
  Client,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');

// グローバルなエラーハンドリングを追加
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:');
  console.error(reason);
});

// web-streams-polyfillのインポート
//require('web-streams-polyfill');

// 環境変数をロード
require('dotenv').config();

// ボットの基本設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// グローバル変数
const activeRecruitments = new Map(); // 現在進行中の募集を保持
const attributes = ['火', '水', '土', '風', '光', '闇']; // グラブルの属性
const raidTypes = ['天元', 'ルシゼロ', '参加者希望']; // レイドタイプ
const timeOptions = []; // 時間オプション（後で初期化）

// 時間オプションを初期化
for (let i = 0; i < 24; i++) {
  const hour = i.toString().padStart(2, '0');
  timeOptions.push({
    label: `${hour}:00`,
    value: `${hour}:00`
  });
}

// ボットの準備完了時に実行
client.once('ready', () => {
  console.log(`${client.user.tag} でログインしました！`);
  console.log('Discord.js バージョン:', require('discord.js').version);
  console.log('デバッグモード: 有効');
  
  // 定期的な処理の開始
  setInterval(saveRecruitmentData, 5 * 60 * 1000); // 5分ごとにデータ保存
  setInterval(checkAutomaticClosing, 60 * 1000); // 1分ごとに自動締め切りチェック
});

// 募集データの保存処理
function saveRecruitmentData() {
  console.log('募集データを保存しています...');
  // ここにデータ保存のロジックを実装
  // 例: ファイルシステムやデータベースへの書き込み
  console.log(`${activeRecruitments.size}件の募集データを保存しました`);
}

// デバッグログ出力
function debugLog(tag, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

// メインのinteractionCreateイベントハンドラ
client.on('interactionCreate', async interaction => {
  try {
    // ボタンインタラクション
    if (interaction.isButton()) {
      // IDチェック用ボタン処理
      if (interaction.customId.startsWith('short_') || 
          interaction.customId.startsWith('medium_') || 
          interaction.customId.startsWith('long_')) {
          
        const parts = interaction.customId.split('_');
        const type = parts[0];
        const id = parts.slice(1).join('_'); // 残りの部分をすべて結合

        console.log(`IDチェック - タイプ: ${type}, ID: ${id}, 長さ: ${id.length}`);

        await interaction.reply({
          content: `IDチェック結果:\nタイプ: ${type}\nID: ${id}\nID長さ: ${id.length}文字`,
          ephemeral: true
        });
        return;
      }
      
      // テスト用確認ボタン処理
      if (interaction.customId === 'timetest_confirm') {
        try {
          await interaction.reply({
            content: 'テスト確認完了！',
            ephemeral: true
          });
          return;
        } catch (error) {
          console.error('テスト確認エラー:', error);
        }
      }
      
      // シンプルテストボタン
      if (interaction.customId === 'simple_test') {
        await interaction.reply({
          content: 'テストボタンが正常に動作しています！',
          ephemeral: true
        });
        return;
      }
      
      // 確認ボタンの処理
      if (interaction.customId.startsWith('confirm_')) {
        // confirm_recruitment_で始まる場合は特別な処理にスキップ
        if (interaction.customId.startsWith('confirm_recruitment_')) {
          await handleButtonInteraction(interaction);
          return;
        }
        
        console.log('確認ボタンを検出: ' + interaction.customId);
        
        try {
          // deferReplyで応答の時間を確保
          await interaction.deferReply({ ephemeral: true });
          console.log('確認ボタン deferReply成功');
          
          // recruitmentIdを抽出
          const recruitmentId = interaction.customId.replace('confirm_', '');
          console.log(`確認ボタン recruitmentId: ${recruitmentId}`);
// 募集IDでデータを検索（完全IDと部分IDの両方で試行）
let recruitment = null;
    
// まずは直接IDで検索
recruitment = activeRecruitments.get(recruitmentId);

// 見つからない場合、フルIDで検索
if (!recruitment) {
  const fullId = `${recruitmentId}_${interaction.user.id}`;
  recruitment = activeRecruitments.get(fullId);
  console.log(`フルIDで再検索: ${fullId}, 結果: ${recruitment ? '成功' : '失敗'}`);
}

// それでも見つからない場合は全ての募集をチェック
if (!recruitment) {
  console.log('全ての募集IDを検索中...');
  for (const [id, data] of activeRecruitments.entries()) {
    console.log(`- 募集ID: ${id}`);
    if (id.startsWith(recruitmentId)) {
      recruitment = data;
      console.log(`部分一致で募集を発見: ${id}`);
      break;
    }
  }
}

if (recruitment) {
  console.log(`募集データ取得成功: ID=${recruitment.id}, 参加者数=${recruitment.participants.length}`);
  
  
  // 既存の参加者でない場合のみ追加
  const existingParticipant = recruitment.participants.find(p => p.userId === interaction.user.id);
  if (existingParticipant) {
    console.log(`ユーザー ${interaction.user.username} は既に参加しています`);
  } else {
    // ここが重要: 参加者データの作成と追加
    const participantData = {
      userId: interaction.user.id,
      username: interaction.user.username,
      joinType: 'なんでも可', // 仮の値
      attributes: ['火', '水', '土', '風', '光', '闇'], // 仮の値
      timeAvailability: '23:00', // 仮の値
      assignedAttribute: null
    };
    
    // 参加者リストに追加
    recruitment.participants.push(participantData);
    console.log(`参加者 ${interaction.user.username} を追加しました。新しい参加者数: ${recruitment.participants.length}`);
    
    // 重要: 更新されたデータを保存
    activeRecruitments.set(recruitment.id, recruitment);
    console.log(`更新された募集データを保存: ID=${recruitment.id}, 新しい参加者数=${recruitment.participants.length}`);
    
    // 募集メッセージの更新
    await updateRecruitmentMessage(recruitment).catch(err => {
    console.error('メッセージ更新エラー:', err.message);
        });
      }
  
  // joinType, selectedAttributes, timeAvailabilityの情報をユーザーデータから取得
  // 仮の値を設定
  //const participantData = {
    //userId: interaction.user.id,
    //username: interaction.user.username,
    //joinType: 'なんでも可', // 仮の値
    //attributes: ['火', '水', '土'], // 仮の値
    //timeAvailability: '20:00', // 仮の値
   // assignedAttribute: null
  //};
  
  // 参加者リストに追加
 // recruitment.participants.push(participantData);
//  console.log(`参加者を追加しました。新しい参加者数: ${recruitment.participants.length}`);
  
  // 募集メッセージの更新
 // await updateRecruitmentMessage(recruitment);
//}

          // 確認メッセージ
          await interaction.editReply({
            content: '参加が確認されました。ありがとうございます！',
          }).catch(err => {
            console.error('確認メッセージ送信エラー:', err.message);
          });
        } else {
          console.log(`エラー: 募集 ${recruitmentId} が見つかりません`);
          const allIds = Array.from(activeRecruitments.keys()).join(', ');
          console.log(`登録されている全募集ID: ${allIds}`);
          
          await interaction.editReply({
            content: 'エラー: 募集データが見つかりません。管理者にお問い合わせください。',
          }).catch(err => {
            console.error('エラーメッセージ送信エラー:', err.message);
          });
        }
          
          console.log('確認メッセージ送信成功');
        } catch (error) {
          console.error('確認ボタン処理エラー:', error);
          console.error('エラー詳細:', error.message);
          console.error('スタックトレース:', error.stack);
          
          handleErrorReply(interaction, error);
        }
        return;
      }
      
      // その他のボタンは専用関数で処理
      await handleButtonInteraction(interaction);
    }
    // セレクトメニューインタラクション
    else if (interaction.isStringSelectMenu()) {
      // テスト用時間選択メニュー処理
      if (interaction.customId === 'timetest_select') {
        try {
          await interaction.deferUpdate();
          console.log('テスト時間選択:', interaction.values[0]);

          const testButton = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('timetest_confirm')
                .setLabel('確認テスト')
                .setStyle(ButtonStyle.Success)
            );

          await interaction.editReply({
            content: `テスト: 「${interaction.values[0]}」を選択しました`,
            components: [testButton]
          });
          return;
        } catch (error) {
          console.error('テスト時間選択エラー:', error);
        }
      }
      
      // 時間選択メニュー処理
// 募集作成用時間選択メニュー処理
else if (interaction.customId.startsWith('recruit_time') || 
interaction.customId.startsWith('recruit_select_') || 
interaction.customId.startsWith('time_select_')) {
console.log('募集作成用時間選択を検出');
const parts = interaction.customId.split('_');
// パターンに応じた抽出
const raidType = parts.length >= 3 ? parts[2] : '';
const date = parts.length >= 4 ? parts[3] : '';
  const selectedTime = interaction.values[0];
  await confirmRecruitment(interaction, raidType, date, selectedTime);
  return; // 処理後に早期リターン
}

// 参加者用時間選択メニュー処理
else if (interaction.customId.startsWith('time_availability_')) {
  try {
    // deferUpdateで応答の時間を確保
    await interaction.deferUpdate().catch(e => 
      console.log('deferUpdate失敗（無視します）:', e.message)
    );
    console.log('本番時間選択 deferUpdate成功');

    // 選択された時間
    const selectedTime = interaction.values[0];
    console.log(`本番選択時間: ${selectedTime}`);

    // カスタムIDから情報を抽出
    const parts = interaction.customId.split('_');
    console.log(`カスタムID構成: ${parts.join('|')}`);
    
    let recruitmentId = '';
    
    // time_availability_の形式を処理
    if (parts.length >= 3) {
      recruitmentId = parts[2];
      console.log(`本番recruitmentId: ${recruitmentId}`);
      console.log(`参加確認用 recruitmentId: ${recruitmentId}`);
    }
// time_availability_の形式なら別途処理
//if (interaction.customId.startsWith('time_availability_') && parts.length >= 3) {
  recruitmentId = parts[2]; // time_availability_RECRUITMENTID_...
  console.log(`参加確認用 recruitmentId: ${recruitmentId}`);
//} else {
  recruitmentId = parts[1] || '';
  console.log(`一般時間選択 recruitmentId: ${recruitmentId}`);
//}

    // 確認ボタン
    const confirmRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_${recruitmentId}`)
          .setLabel('参加を確定する')
          .setStyle(ButtonStyle.Success)
      );

    // 応答
    await interaction.editReply({
      content: `時間「${selectedTime}」を選択しました。参加を確定しますか？`,
      components: [confirmRow],
      embeds: []
    }).catch(e => {
      console.error('editReply失敗:', e.message);
    });

    console.log('本番時間選択 確認ボタン表示成功');
  } catch (error) {
    console.error('本番時間選択エラー:', error);
    console.error('エラー詳細:', error.message);
    console.error('スタックトレース:', error.stack);
    
    handleErrorReply(interaction, error);
  }
  return;
}

// 監視用のログ
debugLog('MONITOR', `セレクトメニュー検出: ${interaction.customId}`, {
  guildId: interaction.guildId,
  channelId: interaction.channelId,
  userId: interaction.user.id,
  values: interaction.values
});

// その他のセレクトメニューは専用関数で処理
await handleSelectMenuInteraction(interaction);
}

  } catch (error) {
    console.error('インタラクション処理エラー:', error);
    handleErrorReply(interaction, error);
  }
});

// エラー応答ヘルパー関数
// エラー応答ヘルパー関数の改善
async function handleErrorReply(interaction, error) {
  try {
    // 10062 (Unknown interaction) エラーの場合は単にログ出力
    if (error.code === 10062) {
      console.log('インタラクションタイムアウトまたは未知のインタラクション - 無視します');
      return;
    }
    // 40060 (Already acknowledged) エラーの場合も単にログ出力
    if (error.code === 40060) {
      console.log('インタラクションは既に応答済み - 無視します');
      return;
    }

    if (interaction.deferred) {
      await interaction.editReply({ 
        content: 'エラーが発生しました。もう一度お試しください。' 
      }).catch(e => console.log('editReply 失敗:', e.message));
    } else if (!interaction.replied) {
      await interaction.reply({ 
        content: 'エラーが発生しました。', 
        ephemeral: true 
      }).catch(e => console.log('reply 失敗:', e.message));
    }
  } catch (replyErr) {
    console.error('エラー応答失敗:', replyErr);
  }
}

// カスタムIDの構造を調査するためのコマンド
client.on('messageCreate', async message => {
    if (message.author.bot) return;
  
    if (message.content === '!idcheck') {
      try {
        // 様々な長さのIDで試す
        const shortId = 'test123';
        const mediumId = '1234567890abcdef';
        const longId = 'verylongidtestthatmightcauseissues12345678901234567890';
  
        const components = [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`short_${shortId}`)
              .setLabel('短いID')
              .setStyle(ButtonStyle.Primary)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`medium_${mediumId}`)
              .setLabel('中程度のID')
              .setStyle(ButtonStyle.Primary)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`long_${longId}`)
              .setLabel('長いID')
              .setStyle(ButtonStyle.Primary)
          )
        ];
  
        await message.reply({
          content: 'カスタムIDテスト - 各ボタンをクリックしてIDの処理をテスト',
          components: components
        });
      } catch (error) {
        console.error('IDチェックエラー:', error);
        message.reply('IDチェックエラー: ' + error.message);
      }
    }
  });
  
  // 新しいデバッグ用コマンド：時間フローテスト
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
  
    if (message.content === '!timeflow') {
      try {
        console.log('時間フローテスト開始');
  
        // 単純なIDと時間選択
        const testId = Date.now().toString();
  
        // 時間選択メニュー
        const timeMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`timeflow_${testId}`)
              .setPlaceholder('テスト用時間選択')
              .addOptions([
                { label: '19:00', value: '19:00', description: 'テスト19時' },
                { label: '20:00', value: '20:00', description: 'テスト20時' }
              ])
          );
  
        // メッセージを送信
        await message.reply({
          content: '⚠ デバッグ専用：時間選択→確認ボタン のフローをテスト',
          components: [timeMenu]
        });
  
        console.log(`timeflowテスト送信: ID=${testId}`);
      } catch (error) {
        console.error('timeflowテストエラー:', error);
        message.reply('テスト開始時にエラーが発生しました');
      }
    }
  });
  
  // 新しいタイムテストコマンド
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
  
    if (message.content === '!timetest') {
      try {
        // 時間選択メニュー作成
        const testTimeMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('timetest_select')
              .setPlaceholder('時間を選択してください')
              .addOptions([
                { label: '12:00', value: '12:00' },
                { label: '13:00', value: '13:00' },
                { label: '14:00', value: '14:00' }
              ])
          );
  
        await message.reply({
          content: 'テスト用時間選択メニュー',
          components: [testTimeMenu]
        });
      } catch (error) {
        console.error('テストコマンドエラー:', error);
      }
    }
  });
  
  // Discord.js v14テストコマンド
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
  
    if (message.content === '!v14test') {
      try {
        console.log('テストコマンドを受信');
  
        // V14でのボタン作成
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('simple_test')
              .setLabel('テストボタン')
              .setStyle(ButtonStyle.Primary)
          );
  
        await message.reply({
          content: 'Discord.js v14テスト - このボタンをクリックしてください',
          components: [row]
        });
  
        console.log('テストメッセージを送信しました');
      } catch (error) {
        console.error('テストコマンドエラー:', error);
        await message.reply(`エラーが発生しました: ${error.message}`);
      }
    }
  });
  
  // メッセージコマンドハンドラ
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
  
    // !募集コマンドで募集作成開始
    if (message.content === '!募集') {
      await startRecruitment(message);
    }
  });
  
  // ボタンインタラクション処理関数
  async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    console.log(`ボタン処理: ${customId}`);
  
    // レイドタイプ選択
    if (customId.startsWith('raid_type_')) {
      const raidType = customId.replace('raid_type_', '');
      await showDateSelection(interaction, raidType);
    }
    // 日付選択
    else if (customId.startsWith('date_')) {
      const [_, action, raidType, dateStr] = customId.split('_');
  
      if (action === 'select') {
        // 日付選択後の時間選択画面表示
        await showTimeSelection(interaction, raidType, dateStr);
      }
    }
    // 募集確定ボタン
    else if (customId.startsWith('confirm_recruitment_')) {
      const recruitmentId = customId.replace('confirm_recruitment_', '');
      await finalizeRecruitment(interaction, recruitmentId);
    }
    // 募集キャンセルボタン
    else if (customId === 'cancel_recruitment') {
      await interaction.update({
        content: '募集作成をキャンセルしました。',
        embeds: [],
        components: []
      });
    }
    // 参加申込ボタン
    else if (customId.startsWith('join_recruitment_')) {
      const recruitmentId = customId.replace('join_recruitment_', '');
      await showJoinOptions(interaction, recruitmentId);
    }
    // 参加キャンセルボタン
    else if (customId.startsWith('cancel_participation_')) {
      const recruitmentId = customId.replace('cancel_participation_', '');
      await cancelParticipation(interaction, recruitmentId);
    }
    // 募集締め切りボタン
    else if (customId.startsWith('close_recruitment_')) {
      const recruitmentId = customId.replace('close_recruitment_', '');
      await closeRecruitment(interaction, recruitmentId);
    }
    // 参加確定ボタン
    else if (customId.startsWith('confirm_join_')) {
      const [_, __, recruitmentId, joinType, attributesStr, timeAvailability] = customId.split('_');
      const selectedAttributes = attributesStr.split(',');
      await confirmParticipation(interaction, recruitmentId, joinType, selectedAttributes, timeAvailability);
    }
    // 参加申込キャンセルボタン
    else if (customId === 'cancel_join') {
      await interaction.update({
        content: '参加申込をキャンセルしました。',
        embeds: [],
        components: []
      });
    }
    // その他の未処理ボタン
    else {
      console.log(`未処理のボタンID: ${customId}`);
      await interaction.reply({ 
        content: 'このボタンは現在サポートされていません', 
        ephemeral: true 
      });
    }
  }
  
// セレクトメニュー処理関数
async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    console.log(`セレクトメニュー処理: ${customId}`);
  
// 募集作成用時間選択 (新しいカスタムIDに対応)
if (customId.startsWith('recruit_time_') || customId.startsWith('recruit_select_') || customId.startsWith('time_select_')) {
  console.log('募集作成用時間選択を検出');
  // IDパターンの抽出を柔軟に
  const parts = customId.split('_');
  // recruit_time_TYPE_DATE や recruit_select_TYPE_DATE の形式に対応
  const raidType = parts.length >= 3 ? parts[2] : '';
  const date = parts.length >= 4 ? parts[3] : '';
  const selectedTime = interaction.values[0];
  await confirmRecruitment(interaction, raidType, date, selectedTime);
}
    
    // 時間選択メニュー処理
    if (customId.startsWith('time_')) {
      try {
        console.log('時間選択処理を開始');
  
        // まずdeferUpdateで応答の時間を確保
        await interaction.deferUpdate();
        console.log('deferUpdate成功');
  
        // 選択された時間を取得
        const selectedTime = interaction.values[0];
        console.log(`選択された時間: ${selectedTime}`);
  
        // 募集IDの取得（time_の後の部分）
        const recruitmentId = customId.split('_')[1] || '';
        console.log(`募集ID: ${recruitmentId}`);
  
        // 確認ボタン作成
        const confirmButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`confirm_${recruitmentId}`)
              .setLabel('参加を確定する')
              .setStyle(ButtonStyle.Success)
          );
  
        // 応答を編集
        await interaction.editReply({
          content: `時間「${selectedTime}」を選択しました。参加を確定しますか？`,
          components: [confirmButton],
          embeds: [] // 明示的に空にする
        });
  
        console.log('参加確認UI表示完了');
      } catch (error) {
        console.error('時間選択処理エラー:', error);
        console.error('エラー詳細:', error.message);
        console.error('スタックトレース:', error.stack);
  
        handleErrorReply(interaction, error);
      }
    }
    // 時間選択
    else if (customId.startsWith('time_select_')) {
      const [_, __, raidType, date] = customId.split('_');
      const selectedTime = interaction.values[0];
      await confirmRecruitment(interaction, raidType, date, selectedTime);
    }
    // 参加タイプ選択（天元/ルシゼロ/なんでも）
    else if (customId.startsWith('join_type_select_')) {
      const recruitmentId = customId.replace('join_type_select_', '');
      const selectedType = interaction.values[0];
      await showAttributeSelection(interaction, recruitmentId, selectedType);
    }
    // 属性選択
    else if (customId.startsWith('attribute_select_')) {
      console.log(`属性選択カスタムID: ${customId}`);
      
      const [_, __, recruitmentId, joinType] = customId.split('_');
      const selectedAttributes = interaction.values;
      await showTimeAvailabilitySelection(interaction, recruitmentId, joinType, selectedAttributes);
    }
    // 参加可能時間選択
    else if (customId.startsWith('time_availability_')) {
      const [_, __, recruitmentId, joinType, attributesStr] = customId.split('_');
      const selectedTime = interaction.values[0];
      const selectedAttributes = attributesStr.split(',');
  
      await showJoinConfirmation(
        interaction,
        recruitmentId,
        joinType,
        selectedAttributes,
        selectedTime
      );
    }
    // 属性選択メニュー
    else if (customId.startsWith('attr_')) {
      console.log('属性選択処理');
  
      // 選択値の取得
      const selectedAttributes = interaction.values;
      console.log(`選択された属性: ${selectedAttributes.join(', ')}`);
  
      // 仮の応答
      await interaction.update({
        content: `属性「${selectedAttributes.join(', ')}」が選択されました`,
        components: []
      });
    }
    // その他のセレクトメニュー
    else {
      console.log(`未処理のセレクトメニューID: ${customId}`);
      await interaction.update({
        content: 'このメニューは現在サポートされていません',
        components: []
      });
    }
  }
  
  // 募集開始処理
  async function startRecruitment(message) {
    // レイドタイプ選択ボタン
    const row = new ActionRowBuilder()
      .addComponents(
        ...raidTypes.map(type =>
          new ButtonBuilder()
            .setCustomId(`raid_type_${type}`)
            .setLabel(type)
            .setStyle(ButtonStyle.Primary)
        )
      );
  
    const embed = new EmbedBuilder()
      .setTitle('🔰 高難易度募集作成')
      .setDescription('募集するレイドタイプを選択してください。')
      .setColor('#0099ff');
  
    const response = await message.reply({
      embeds: [embed],
      components: [row]
    });
  
    // 30分後に自動的にボタンを無効化
    setTimeout(() => {
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          ...raidTypes.map(type =>
            new ButtonBuilder()
              .setCustomId(`raid_type_${type}`)
              .setLabel(type)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          )
        );
  
      response.edit({
        embeds: [embed.setDescription('この募集作成セッションは期限切れになりました。新しく募集を開始するには `!募集` コマンドを使用してください。')],
        components: [disabledRow]
      }).catch(console.error);
    }, 30 * 60 * 1000); // 30分後
  }
  
  // 日付選択UI表示
  async function showDateSelection(interaction, raidType) {
    // 今日から7日分の日付ボタンを作成
    const dateButtons = [];
    const today = new Date();
  
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
  
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;
  
      dateButtons.push(
        new ButtonBuilder()
          .setCustomId(`date_select_${raidType}_${dateString}`)
          .setLabel(displayDate)
          .setStyle(ButtonStyle.Secondary)
      );
    }
  
    // ボタンを行に分ける（1行に最大5つまで）
    const rows = [];
    for (let i = 0; i < dateButtons.length; i += 5) {
      const row = new ActionRowBuilder()
        .addComponents(dateButtons.slice(i, Math.min(i + 5, dateButtons.length)));
      rows.push(row);
    }
  
    const embed = new EmbedBuilder()
      .setTitle(`📅 ${raidType}募集 - 日付選択`)
      .setDescription('開催したい日付を選択してください。')
      .setColor('#0099ff');
  
    await interaction.update({
      embeds: [embed],
      components: rows
    });
  }
  // 時間選択UI表示
async function showTimeSelection(interaction, raidType, date) {
    // 時間選択用セレクトメニュー
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`recruit_time_${raidType}_${date}`)
          .setPlaceholder('開催時間を選択してください')
          .addOptions(timeOptions)
      );
  
    const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  
    const embed = new EmbedBuilder()
      .setTitle(`⏰ ${raidType}募集 - 時間選択`)
      .setDescription(`選択した日付: ${formattedDate}\n開催時間を選択してください。`)
      .setColor('#0099ff');
  
    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
  
  // 募集確認UI表示
  async function confirmRecruitment(interaction, raidType, date, time) {
    const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  
    const recruitmentId = `${Date.now()}_${interaction.user.id}`;
  
    const embed = new EmbedBuilder()
      .setTitle('🔍 募集内容確認')
      .setDescription('以下の内容で募集を開始します。よろしければ「確定」ボタンを押してください。')
      .setColor('#0099ff')
      .addFields(
        { name: 'レイドタイプ', value: raidType, inline: true },
        { name: '開催日', value: formattedDate, inline: true },
        { name: '開催時間', value: time, inline: true },
        { name: '募集者', value: interaction.user.toString(), inline: true }
      );
  
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_recruitment_${recruitmentId}`)
          .setLabel('確定')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_recruitment')
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Danger)
      );
  
    // 一時データを保存
    const recruitmentData = {
      id: recruitmentId,
      type: raidType,
      date: date,
      time: time,
      creator: interaction.user.id,
      participants: [],
      status: 'pending',
      channel: interaction.channelId,
      messageId: null
    };
  
    activeRecruitments.set(recruitmentId, recruitmentData);
  
    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
  
  // 募集確定処理
  async function finalizeRecruitment(interaction, recruitmentId) {
    console.log(`募集確定処理開始: ${recruitmentId}`);
  
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment) {
      console.error(`募集データが見つかりません: ${recruitmentId}`);
      return await interaction.update({
        content: 'エラー: 募集データが見つかりません。',
        embeds: [],
        components: []
      });
    }
  
    recruitment.status = 'active';
    
    const formattedDate = new Date(recruitment.date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  
    const embed = new EmbedBuilder()
      .setTitle(`📢 【募集】${recruitment.type} - ${formattedDate} ${recruitment.time}`)
      .setDescription(`募集者: <@${recruitment.creator}>\n\n参加希望の方は下のボタンから申し込んでください。`)
      .setColor('#0099ff')
      .addFields(
        ...attributes.map(attr => {
          return { name: `【${attr}】`, value: '未定', inline: true };
        })
      )
      .setFooter({ text: `募集ID: ${recruitmentId} | 開催日の朝8時に自動締め切り` });
  
    const joinRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`join_recruitment_${recruitmentId}`)
          .setLabel('参加申込')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`cancel_participation_${recruitmentId}`)
          .setLabel('参加キャンセル')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`close_recruitment_${recruitmentId}`)
          .setLabel('募集締め切り')
          .setStyle(ButtonStyle.Danger)
      );
  
    await interaction.update({
      content: '募集を作成しました！',
      embeds: [embed],
      components: [joinRow]
    });
  
    // 重要: メッセージIDを正しく保存
    recruitment.messageId = interaction.message.id;
  
    // デバッグログ
    console.log('募集確定情報:');
    console.log(`- 募集ID: ${recruitmentId}`);
    console.log(`- メッセージID: ${recruitment.messageId}`);
    console.log(`- チャンネルID: ${recruitment.channel}`);
  
    // 更新された募集データを保存
    activeRecruitments.set(recruitmentId, recruitment);
  
    // データが正しく保存されたか確認
    const savedRecruitment = activeRecruitments.get(recruitmentId);
    console.log(`保存確認 - メッセージID: ${savedRecruitment?.messageId}`);
  }
  // 参加オプション表示
async function showJoinOptions(interaction, recruitmentId) {
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment || recruitment.status !== 'active') {
      return await interaction.reply({
        content: 'この募集は既に終了しているか、存在しません。',
        ephemeral: true
      });
    }
  
    // すでに参加している場合
    const existingParticipation = recruitment.participants.find(p => p.userId === interaction.user.id);
    if (existingParticipation) {
      return await interaction.reply({
        content: `あなたはすでにこの募集に参加しています。\n選択した属性: ${existingParticipation.attributes.join(', ')}\n参加可能時間: ${existingParticipation.timeAvailability}`,
        ephemeral: true
      });
    }
  
    const formattedDate = new Date(recruitment.date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  
    let selectOptions = [];
  
    // 募集タイプに応じた参加オプションを設定
    if (recruitment.type === '参加者希望') {
      selectOptions = [
        { label: '天元', value: '天元', description: '天元の戦闘に参加希望' },
        { label: 'ルシゼロ', value: 'ルシゼロ', description: 'ルシファーHL、ゼロ討滅戦に参加希望' },
        { label: 'なんでも可', value: 'なんでも可', description: 'どちらでも参加可能' }
      ];
    } else {
      // 天元またはルシゼロ募集の場合は自動的にそのタイプに設定
      selectOptions = [
        { label: recruitment.type, value: recruitment.type, description: `${recruitment.type}の戦闘に参加` }
      ];
    }
  
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`join_type_select_${recruitmentId}`)
          .setPlaceholder('参加タイプを選択してください')
          .addOptions(selectOptions)
      );
  
    const embed = new EmbedBuilder()
      .setTitle('🎮 参加申込')
      .setDescription(`【${recruitment.type}】${formattedDate} ${recruitment.time}\n\n参加タイプを選択してください。`)
      .setColor('#00cc99');
  
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
  
  // 属性選択UI表示
  async function showAttributeSelection(interaction, recruitmentId, joinType) {
    console.log(`属性選択UI表示: ${recruitmentId}, ${joinType}`);
    
    // デバッグログ追加: 現在の全募集IDを出力
    const allRecruitmentIds = Array.from(activeRecruitments.keys());
    console.log(`現在の全募集ID: [${allRecruitmentIds.join(', ')}]`);
    console.log(`検索する募集ID: ${recruitmentId}`);
  
    // 募集データ取得
    const recruitment = activeRecruitments.get(recruitmentId);
    console.log(`募集データ取得結果: ${recruitment ? '成功' : '失敗'}`);
    if (!recruitment || recruitment.status !== 'active') {
      return await interaction.update({
        content: 'この募集は既に終了しているか、存在しません。',
        embeds: [],
        components: []
      });
    }
  
    const attributeOptions = attributes.map(attr => {
      return {
        label: attr,
        value: attr,
        description: `${attr}属性で参加`
      };
    });
  
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`attribute_select_${recruitmentId}_${joinType}`)
          .setPlaceholder('参加可能な属性を選択してください（複数選択可）')
          .setMinValues(1)
          .setMaxValues(attributes.length)
          .addOptions(attributeOptions)
      );
  
    const embed = new EmbedBuilder()
      .setTitle('🔮 属性選択')
      .setDescription(`参加タイプ: ${joinType}\n\n参加可能な属性を選択してください（複数選択可）。`)
      .setColor('#00cc99');
  
    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
  
  // 時間選択UI表示
  async function showTimeAvailabilitySelection(interaction, recruitmentId, joinType, selectedAttributes) {
    console.log('=== 時間選択UI表示が呼び出されました ===');
    console.log(`recruitmentId: ${recruitmentId}, joinType: ${joinType}`);
  
    try {
      // 時間選択肢
      const timeOptions = [
        { label: '19:00', value: '19:00', description: '19:00から参加可能' },
        { label: '20:00', value: '20:00', description: '20:00から参加可能' },
        { label: '21:00', value: '21:00', description: '21:00から参加可能' },
        { label: '22:00', value: '22:00', description: '22:00から参加可能' },
        { label: '23:00', value: '23:00', description: '23:00から参加可能' },
        { label: '今すぐ', value: 'now', description: '今すぐ参加可能' }
      ];
  
      // timeflowと同じパターンのカスタムID
      const customId = `time_availability_${recruitmentId}_${joinType}_${selectedAttributes.join(',')}`;
      console.log(`使用するカスタムID: ${customId}`);
  
      // UIコンポーネント
      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder('参加可能な時間を選択')
            .addOptions(timeOptions)
        );
  
      const embed = new EmbedBuilder()
        .setTitle('⏰ 参加可能時間の選択')
        .setDescription(`参加タイプ: ${joinType}\n選択した属性: ${selectedAttributes.join(', ')}`)
        .setColor('#00cc99');
  
      // 更新送信
      await interaction.update({
        embeds: [embed],
        components: [row]
      });
  
      console.log('時間選択UI表示成功');
    } catch (error) {
      console.error('時間選択UI表示エラー:', error);
      console.error('エラースタック:', error.stack);
  
      // エラー表示
      await interaction.update({
        content: '時間選択の表示中にエラーが発生しました。もう一度お試しください。',
        embeds: [],
        components: []
      }).catch(e => console.error('エラー応答失敗:', e));
    }
  }
  // 参加確認UI表示
async function showJoinConfirmation(interaction, recruitmentId, joinType, selectedAttributes, timeAvailability) {
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment || recruitment.status !== 'active') {
      return await interaction.update({
        content: 'この募集は既に終了しているか、存在しません。',
        embeds: [],
        components: []
      });
    }
  
    const embed = new EmbedBuilder()
      .setTitle('✅ 参加申込確認')
      .setDescription('以下の内容で参加申込を確定します。')
      .setColor('#00cc99')
      .addFields(
        { name: '参加タイプ', value: joinType, inline: true },
        { name: '参加可能属性', value: selectedAttributes.join(', '), inline: true },
        { name: '参加可能時間', value: timeAvailability, inline: true }
      );
  
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_join_${recruitmentId}_${joinType}_${selectedAttributes.join(',')}_${timeAvailability}`)
          .setLabel('参加確定')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_join')
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Danger)
      );
  
    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
  
  // 参加確定処理
  async function confirmParticipation(interaction, recruitmentId, joinType, selectedAttributes, timeAvailability) {
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment || recruitment.status !== 'active') {
      return await interaction.update({
        content: 'この募集は既に終了しているか、存在しません。',
        embeds: [],
        components: []
      });
    }
  
    // すでに参加している場合は情報を更新
    const existingIndex = recruitment.participants.findIndex(p => p.userId === interaction.user.id);
  
    const participantData = {
      userId: interaction.user.id,
      username: interaction.user.username,
      joinType: joinType,
      attributes: selectedAttributes,
      timeAvailability: timeAvailability,
      assignedAttribute: null // 割り当ては後で行う
    };
  
    if (existingIndex >= 0) {
      recruitment.participants[existingIndex] = participantData;
    } else {
      recruitment.participants.push(participantData);
    }
  
    // 募集メッセージの更新
    await updateRecruitmentMessage(recruitment);
  
    // 参加者が7人以上の場合、自動割り振りを行う
    if (recruitment.participants.length >= 7 && recruitment.status === 'active') {
      await autoAssignAttributes(recruitment);
    }
  
    await interaction.update({
      content: '参加申込が完了しました！',
      embeds: [],
      components: []
    });
  }
  
  // 参加キャンセル処理
  async function cancelParticipation(interaction, recruitmentId) {
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment) {
      return await interaction.reply({
        content: 'この募集は存在しません。',
        ephemeral: true
      });
    }
  
    const participantIndex = recruitment.participants.findIndex(p => p.userId === interaction.user.id);
  
    if (participantIndex === -1) {
      return await interaction.reply({
        content: 'あなたはこの募集に参加していません。',
        ephemeral: true
      });
    }
  
    // 参加者リストから削除
    recruitment.participants.splice(participantIndex, 1);
  
    // 割り振りが行われていた場合、再割り振り
    if (recruitment.status === 'assigned') {
      await autoAssignAttributes(recruitment);
    }
  
    // 募集メッセージの更新
    await updateRecruitmentMessage(recruitment);
  
    await interaction.reply({
      content: '参加をキャンセルしました。',
      ephemeral: true
    });
  }
  
  // 募集締め切り処理
  async function closeRecruitment(interaction, recruitmentId) {
    console.log(`募集締め切り処理を開始: ${recruitmentId}`);
    const recruitment = activeRecruitments.get(recruitmentId);
    if (!recruitment) {
      console.log(`締め切り失敗: 募集ID ${recruitmentId} が見つかりません`);
      return await interaction.reply({
        content: 'この募集は存在しません。',
        ephemeral: true
      });
    }
  
    // 募集者以外は締め切れないようにする
    if (interaction.user.id !== recruitment.creator) {
      console.log(`締め切り拒否: ユーザー ${interaction.user.id} は募集者ではありません`);
      return await interaction.reply({
        content: '募集者のみが募集を締め切ることができます。',
        ephemeral: true
      });
    }
    
    console.log(`募集ステータスを変更: ${recruitment.status} -> closed`);
    recruitment.status = 'closed';
  
    // 属性の自動割り振りを実行
    console.log(`属性の自動割り振りを開始: 参加者数=${recruitment.participants.length}`);
    await autoAssignAttributes(recruitment);
    console.log('属性の自動割り振りが完了しました');

  
    // 募集メッセージの更新
    console.log('募集メッセージの更新を開始');
    await updateRecruitmentMessage(recruitment);
    console.log('募集メッセージの更新が完了しました');
  
    await interaction.reply({
      content: '募集を締め切り、属性の割り振りを行いました。',
      ephemeral: true
    });
  }
  // 募集メッセージ更新処理
async function updateRecruitmentMessage(recruitment) {
    try {
      if (!recruitment || !recruitment.channel || !recruitment.messageId) {
        console.log('募集メッセージ更新: 必要な情報が不足しています');
        return;
      }
      const channel = await client.channels.fetch(recruitment.channel).catch(e => {
        console.error('チャンネル取得エラー:', e.message);
        return null;
      });
      if (!channel)  {
        console.error(`チャンネルID ${recruitment.channel} が見つかりません`);
        return;
      }
  
      const message = await channel.messages.fetch(recruitment.messageId).catch(e => {
        console.error('メッセージ取得エラー:', e.message);
        return null;
      });
      
      if (!message) {
        console.error(`メッセージID ${recruitment.messageId} が見つかりません`);
        return;
      }
  
      const formattedDate = new Date(recruitment.date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
  
      // 参加者情報を集計
      const participantsByAttribute = {};
      attributes.forEach(attr => {
        participantsByAttribute[attr] = [];
      });
  
      // 参加者を属性ごとに分類
      recruitment.participants.forEach(participant => {
        participant.attributes.forEach(attr => {
          if (!participantsByAttribute[attr].includes(participant)) {
            participantsByAttribute[attr].push(participant);
          }
        });
      });
  
      let description = `募集者: <@${recruitment.creator}>\n\n`;
  
      // 募集ステータスに応じた表示
      if (recruitment.status === 'active') {
        description += '🟢 **募集中**\n参加希望の方は下のボタンから申し込んでください。\n\n';
      } else if (recruitment.status === 'closed' || recruitment.status === 'assigned') {
        description += '🔴 **募集終了**\n';
  
  // 最終的な開催時間と日付を表示
  if (recruitment.finalTime) {
    description += `**開催予定時間: ${recruitment.finalTime}**\n`;
  }
  
  description += '以下の通り参加者を割り振りました。\n\n';
}
  
      // 参加者の詳細リスト（募集中の場合）
      if (recruitment.status === 'active' && recruitment.participants.length > 0) {
        description += '**【参加表明者】**\n';
        const participantsByTime = {};
  
        recruitment.participants.forEach(p => {
          if (!participantsByTime[p.timeAvailability]) {
            participantsByTime[p.timeAvailability] = [];
          }
          participantsByTime[p.timeAvailability].push(p);
        });
  
        // 時間帯ごとに表示
        Object.keys(participantsByTime).sort().forEach(time => {
          description += `⏰ **${time}〜** (${participantsByTime[time].length}名)\n`;
          participantsByTime[time].forEach(p => {
            description += `- <@${p.userId}> [${p.joinType}] ${p.attributes.join('/')}\n`;
          });
          description += '\n';
        });
      }
  
      // エンベッド作成
      const embed = new EmbedBuilder()
        .setTitle(`${recruitment.status === 'active' ? '📢' : '🏁'} 【${recruitment.type}】${formattedDate} ${recruitment.time}`)
        .setDescription(description)
        .setColor(recruitment.status === 'active' ? '#0099ff' : '#ff6666');
  
      // 各属性のフィールドを設定
      const fields = [];
      attributes.forEach(attr => {
        let value = '未定';
  
        // 割り振り済みの場合
        if (recruitment.status === 'closed' || recruitment.status === 'assigned') {
          const assignedParticipant = recruitment.participants.find(p => p.assignedAttribute === attr);
          if (assignedParticipant) {
            value = `<@${assignedParticipant.userId}>`;
          }
        } else {
          // 募集中の場合は各属性の希望者数を表示
          const count = participantsByAttribute[attr].length;
          value = count > 0 ? `${count}名が希望` : '未定';
        }
  
        fields.push({ name: `【${attr}】`, value: value, inline: true });
      });
  
      embed.addFields(fields);
      embed.setFooter({ text: `募集ID: ${recruitment.id} | ${recruitment.status === 'active' ? '開催日の朝8時に自動締め切り' : '募集終了'}` });
  
      // ボタン行を作成（募集中の場合のみ有効）
      const joinRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`join_recruitment_${recruitment.id}`)
            .setLabel('参加申込')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(recruitment.status !== 'active'),
          new ButtonBuilder()
            .setCustomId(`cancel_participation_${recruitment.id}`)
            .setLabel('参加キャンセル')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(recruitment.status !== 'active'),
          new ButtonBuilder()
            .setCustomId(`close_recruitment_${recruitment.id}`)
            .setLabel('募集締め切り')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(recruitment.status !== 'active' || recruitment.creator !== message.author.id)
        );
  
      // メッセージを更新
      await message.edit({
        content: recruitment.status === 'active' ? '**【募集中】**' : '**【募集終了】**',
        embeds: [embed],
        components: [joinRow]
      }).catch(e => {
        console.error('メッセージ編集エラー:', e.message);
      });
    } catch (error) {
      console.error('募集メッセージ更新エラー:', error);
    }
  }
  
  // 属性自動割り振り処理
  async function autoAssignAttributes(recruitment) {
    console.log('=== 属性自動割り振り処理 開始 ===');
    // 割り振りが必要ない場合
    if (recruitment.participants.length === 0) {
      console.log('参加者がいないため、割り振りをスキップします');
      return;
    }
  
    recruitment.status = 'assigned';
    console.log(`ステータスを'assigned'に変更しました`);
  
    // 時間帯ごとに参加者をグループ化
    const participantsByTime = {};
    recruitment.participants.forEach(p => {
      if (!participantsByTime[p.timeAvailability]) {
        participantsByTime[p.timeAvailability] = [];
      }
      participantsByTime[p.timeAvailability].push({ ...p });
    });
  
    // 各時間帯の参加者に対して属性割り振りを実行
    const timeSlots = Object.keys(participantsByTime).sort();
    console.log(`利用可能な時間枠: ${timeSlots.join(', ')}`);
  
    // 最適な時間帯を見つける（参加者が最も多い時間帯）
    let bestTimeSlot = timeSlots[0] || 'デフォルト';
    let maxParticipants = 0;
  
    timeSlots.forEach(timeSlot => {
      // 参加タイプによるフィルタリング
      const filteredParticipants = participantsByTime[timeSlot].filter(p => {
        if (recruitment.type === '天元') {
          return p.joinType === '天元' || p.joinType === 'なんでも可';
        } else if (recruitment.type === 'ルシゼロ') {
          return p.joinType === 'ルシゼロ' || p.joinType === 'なんでも可';
        } else {
          // 参加者希望の場合は全員対象
          return true;
        }
      });
      
      console.log(`時間枠 ${timeSlot}: ${filteredParticipants.length}名が参加可能`);
  
      if (filteredParticipants.length > maxParticipants) {
        maxParticipants = filteredParticipants.length;
        bestTimeSlot = timeSlot;
      }
    });
    
    console.log(`最適な時間枠: ${bestTimeSlot} (参加者数: ${maxParticipants}名)`);
    
      // 一番参加者が多い時間帯のレイドタイプを決定（参加者希望の場合のみ）
  let raidTypeToAssign = recruitment.type;
  if (recruitment.type === '参加者希望') {
    const participantsInBestTimeSlot = participantsByTime[bestTimeSlot];

    let tengenCount = 0;
    let luciZeroCount = 0;

    participantsInBestTimeSlot.forEach(p => {
      if (p.joinType === '天元') tengenCount++;
      else if (p.joinType === 'ルシゼロ') luciZeroCount++;
    });

    raidTypeToAssign = tengenCount > luciZeroCount ? '天元' : 'ルシゼロ';
  }

  // 選択された時間帯とレイドタイプに基づいて参加者をフィルタリング
  const eligibleParticipants = participantsByTime[bestTimeSlot].filter(p => {
    if (raidTypeToAssign === '天元') {
      return p.joinType === '天元' || p.joinType === 'なんでも可';
    } else {
      return p.joinType === 'ルシゼロ' || p.joinType === 'なんでも可';
    }
  });
  console.log(`割り振り対象参加者数: ${eligibleParticipants.length}名`);
  // 属性の割り振り処理
  const assignments = {};
  console.log('=== 属性割り振り結果 ===');
  attributes.forEach(attr => {
    const assigned = recruitment.participants.find(p => p.assignedAttribute === attr);
    console.log(`${attr}: ${assigned ? assigned.username : '未割り当て'}`);
  });

  // 優先順位付け：
  // 1. 特定の属性だけを選択している人を優先
  // 2. 選択属性数が少ない人を優先

  // 参加者を属性選択数で並べ替え
  eligibleParticipants.sort((a, b) => a.attributes.length - b.attributes.length);
// 各参加者用のデバッグ情報
eligibleParticipants.forEach((p, index) => {
  console.log(`参加者${index + 1}: ${p.username}, 希望属性: [${p.attributes.join(', ')}], 属性数: ${p.attributes.length}`);
});
  
  
  // 各参加者について、選択した属性のうち最も希望者が少ない属性に割り当て
  for (const participant of eligibleParticipants) {
    // この参加者が選択した属性で、まだ割り当てられていないものを探す
    const availableAttributes = participant.attributes.filter(attr => !assignments[attr]);
    console.log(`${participant.username}の利用可能な属性: [${availableAttributes.join(', ')}]`);
    
    if (availableAttributes.length > 0) {
      // 利用可能な属性から一つ選択
      const chosenAttribute = availableAttributes[0];
      assignments[chosenAttribute] = participant;
      participant.assignedAttribute = chosenAttribute;
      console.log(`${participant.username}を${chosenAttribute}属性に割り当てました`);
    } else {
      console.log(`${participant.username}に割り当て可能な属性がありません`);
    }
  }

  // 埋まっていない属性を、まだ割り当てられていない参加者で埋める
  const unassignedParticipants = eligibleParticipants.filter(p => !p.assignedAttribute);
  const emptyAttributes = attributes.filter(attr => !assignments[attr]);
  
  console.log(`未割り当て参加者: ${unassignedParticipants.length}名`);
  console.log(`空の属性: [${emptyAttributes.join(', ')}]`);

  for (let i = 0; i < Math.min(unassignedParticipants.length, emptyAttributes.length); i++) {
    const participant = unassignedParticipants[i];
    const attr = emptyAttributes[i];

    // 参加者の希望属性に含まれていない場合でも割り当て
    assignments[attr] = participant;
    participant.assignedAttribute = attr;
  }

  // 割り当て結果を元の参加者リストに反映
  for (const participant of recruitment.participants) {
    const assignedParticipant = eligibleParticipants.find(p => p.userId === participant.userId);
    if (assignedParticipant && assignedParticipant.assignedAttribute) {
      participant.assignedAttribute = assignedParticipant.assignedAttribute;
      console.log(`元のリストで ${participant.username} を ${participant.assignedAttribute} に設定しました`);
    } else {
      participant.assignedAttribute = null;
      console.log(`${participant.username} は割り当てられませんでした`);
    }
  }

  // 時間とレイドタイプを更新
  recruitment.finalTime = bestTimeSlot;
  recruitment.finalRaidType = raidTypeToAssign;
  console.log(`最終開催時間: ${bestTimeSlot}, 最終レイドタイプ: ${raidTypeToAssign}`);

  return recruitment;
}

// 自動締め切りチェック
function checkAutomaticClosing() {
  const now = new Date();

  activeRecruitments.forEach(async (recruitment, id) => {
    if (recruitment.status !== 'active') return;

    const raidDate = new Date(recruitment.date);
    raidDate.setHours(8, 0, 0, 0); // 開催日の朝8時

    // 開催日の朝8時を過ぎている場合、自動締め切り
    if (now >= raidDate) {
      recruitment.status = 'closed';
      await autoAssignAttributes(recruitment);
      await updateRecruitmentMessage(recruitment);

      // 終了メッセージを送信
      try {
        const channel = await client.channels.fetch(recruitment.channel);
        if (channel) {
          await channel.send({
            content: `<@${recruitment.creator}> **【自動締め切り】** ${recruitment.type}募集が締め切られ、参加者が割り振られました。`
          });
        }
      } catch (error) {
        console.error('自動締め切りメッセージ送信エラー:', error);
      }
    }
  });
}

// 募集管理機能 - 募集リスト表示
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!募集リスト') {
    await showActiveRecruitments(message);
  }
});

// 募集リスト表示機能
async function showActiveRecruitments(message) {
  const activeList = Array.from(activeRecruitments.values())
    .filter(r => r.status === 'active');

  if (activeList.length === 0) {
    return message.reply('現在募集中の高難易度レイドはありません。');
  }

  const embed = new EmbedBuilder()
    .setTitle('🔍 現在募集中のレイド一覧')
    .setDescription('参加するには該当の募集メッセージで「参加申込」ボタンを押してください。')
    .setColor('#0099ff');

  // 募集情報を整理
  activeList.forEach((recruitment, index) => {
    const formattedDate = new Date(recruitment.date).toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric'
    });

    const participantCount = recruitment.participants.length;

    embed.addFields({
      name: `${index + 1}. ${recruitment.type} - ${formattedDate} ${recruitment.time}`,
      value: `募集者: <@${recruitment.creator}>\n参加者数: ${participantCount}名\n[募集ページへジャンプ](https://discord.com/channels/${message.guildId}/${recruitment.channel}/${recruitment.messageId})`
    });
  });

  await message.reply({ embeds: [embed] });
}

// 募集削除コマンド
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.startsWith('!募集削除 ')) {
    const recruitmentId = message.content.replace('!募集削除 ', '');
    await deleteRecruitment(message, recruitmentId);
  }
});

// 募集削除処理
async function deleteRecruitment(message, recruitmentId) {
  const recruitment = activeRecruitments.get(recruitmentId);

  if (!recruitment) {
    return message.reply('指定された募集IDは存在しません。');
  }

  // 募集者またはサーバー管理者のみ削除可能
  if (recruitment.creator !== message.author.id && !message.member.permissions.has('ADMINISTRATOR')) {
    return message.reply('募集者またはサーバー管理者のみが募集を削除できます。');
  }

  try {
    // 募集メッセージを更新
    const channel = await client.channels.fetch(recruitment.channel);
    if (channel) {
      const recruitMessage = await channel.messages.fetch(recruitment.messageId);
      if (recruitMessage) {
        await recruitMessage.edit({
          content: '**【募集削除】** この募集は削除されました。',
          embeds: [],
          components: []
        });
      }
    }

    // 募集データを削除
    activeRecruitments.delete(recruitmentId);

    await message.reply(`募集ID: ${recruitmentId} の募集を削除しました。`);
  } catch (error) {
    console.error('募集削除エラー:', error);
    await message.reply('募集の削除中にエラーが発生しました。');
  }
}

// ヘルプ表示
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!募集ヘルプ') {
    await showHelp(message);
  }
});

// ヘルプ表示機能
async function showHelp(message) {
  const embed = new EmbedBuilder()
    .setTitle('📚 グラブル高難易度募集Bot ヘルプ')
    .setDescription('グランブルーファンタジーの高難易度レイド（天元/ルシゼロ）募集を簡単に行うためのボットです。')
    .setColor('#00cc99')
    .addFields(
      {
        name: '基本コマンド',
        value: '`!募集` - 新しいレイド募集を開始します\n`!募集リスト` - 現在進行中の募集一覧を表示します\n`!募集ヘルプ` - このヘルプを表示します'
      },
      {
        name: '募集作成の流れ',
        value: '1. `!募集` コマンドを入力\n2. レイドタイプを選択（天元/ルシゼロ/参加者希望）\n3. 開催日を選択\n4. 開催時間を選択\n5. 内容を確認して募集開始'
      },
      {
        name: '参加申込の流れ',
        value: '1. 募集メッセージの「参加申込」ボタンをクリック\n2. 参加タイプを選択（参加者希望の場合のみ）\n3. 参加可能な属性を選択（複数選択可）\n4. 参加可能時間を選択\n5. 内容を確認して参加確定'
      },
      {
        name: '属性割り振りについて',
        value: '- 7人以上の参加表明があった場合、自動的に割り振りが行われます\n- 開催日の朝8時に自動的に締め切られ、割り振りが確定します\n- 募集者は「募集締め切り」ボタンで手動締め切りも可能です'
      },
      {
        name: '管理コマンド',
        value: '`!募集削除 [募集ID]` - 指定した募集を削除します（募集者または管理者のみ）'
      }
    )
    .setFooter({ text: 'ボタン操作だけで簡単に募集・参加ができます！' });

  await message.reply({ embeds: [embed] });
}

// デバッグ用コマンド - 募集確認
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.startsWith('!募集確認 ')) {
    const recruitmentId = message.content.replace('!募集確認 ', '');
    const recruitment = activeRecruitments.get(recruitmentId);

    if (!recruitment) {
      return message.reply('指定された募集IDは存在しません。');
    }

    // 募集データの詳細を表示
    const details = {
      id: recruitment.id,
      type: recruitment.type,
      status: recruitment.status,
      参加者数: recruitment.participants.length,
      メッセージID: recruitment.messageId,
      チャンネルID: recruitment.channel
    };

    // 参加者情報
    const participantsInfo = recruitment.participants.map(p => {
      return {
        ユーザー名: p.username,
        参加タイプ: p.joinType,
        属性: p.attributes.join(','),
        割り当て属性: p.assignedAttribute || '未割り当て'
      };
    });

    await message.reply({
      content: '```json\n' + JSON.stringify(details, null, 2) + '\n```\n' +
               '**参加者情報:**\n```json\n' + JSON.stringify(participantsInfo, null, 2) + '\n```',
      allowedMentions: { users: [] }
    });
  }
});

// デバッグ用コマンド - 募集データ詳細確認
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!募集詳細確認') {
    const allRecruitments = Array.from(activeRecruitments.entries());

    if (allRecruitments.length === 0) {
      return message.reply('現在募集データはありません。');
    }

    let debugInfo = '**現在の募集データ**\n\n';

    allRecruitments.forEach(([id, data]) => {
      debugInfo += `**募集ID**: \`${id}\`\n`;
      debugInfo += `- タイプ: ${data.type}\n`;
      debugInfo += `- 状態: ${data.status}\n`;
      debugInfo += `- 日付: ${data.date}\n`;
      debugInfo += `- 時間: ${data.time}\n`;
      debugInfo += `- メッセージID: ${data.messageId}\n`;
      debugInfo += `- 参加者数: ${data.participants.length}名\n\n`;
    });

    // 長さ制限があるので、1000文字以上なら分割
    if (debugInfo.length > 1900) {
      const parts = [];
      for (let i = 0; i < debugInfo.length; i += 1900) {
        parts.push(debugInfo.substring(i, i + 1900));
      }

      for (const part of parts) {
        await message.channel.send(part);
      }
    } else {
      await message.reply(debugInfo);
    }
  }
});

// 未処理のエラーをキャッチ
process.on('unhandledRejection', error => {
  console.error('未処理のPromise拒否:', error);
});

// Botログイン
client.login(process.env.TOKEN).catch(console.error);
