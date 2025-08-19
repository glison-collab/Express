// ====== 前置准备 ======
let fm = FileManager.iCloud();
let imgPath = fm.joinPath(fm.documentsDirectory(), "kuaidi.png");
let dataPath = fm.joinPath(fm.documentsDirectory(), "kuaidi.json");

function pad(n) { return n < 10 ? "0" + n : n; }
function color(light, dark) { return Color.dynamic(new Color(light), new Color(dark)); }
function simplifyCompanyName(name) {
  if (!name) return "未知快递";
  return name.replace(/^【|】$/g, "").replace(/快递|物流/g, "").replace(/\s+/g, "") || "未知快递";
}
function createSeparatorImage(width) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, 1);
  ctx.setFillColor(color("#EEEEEE", "#333333"));
  ctx.fillRect(new Rect(0, 0, width, 1));
  return ctx.getImage();
}
async function ensureFile(path) {
  console.log(`[日志] 检查文件是否存在：${path}`);
  if (fm.fileExists(path)) {
    if (fm.isFileStoredIniCloud(path) && !fm.isFileDownloaded(path)) {
      console.log(`[日志] 文件在 iCloud 上未下载，开始下载：${path}`);
      await fm.downloadFileFromiCloud(path);
      console.log(`[日志] 文件下载完成：${path}`);
    }
    return true;
  }
  console.log(`[日志] 文件不存在：${path}`);
  return false;
}
function showErrorWidget(message) {
  console.log(`[错误] ${message}`);
  let w = new ListWidget();
  w.backgroundColor = color("#FFFFFF", "#1C1C1E");
  w.cornerRadius = 16;
  w.setPadding(12, 12, 12, 12);
  let text = w.addText(message);
  text.font = Font.systemFont(14);
  text.textColor = Color.red();
  text.centerAlignText();
  Script.setWidget(w);
  Script.complete();
}

// ====== 网络图片加载 ======
async function loadNetworkImage(url, localPath) {
  try {
    const req = new Request(url);
    const image = await req.loadImage();
    if (image && localPath) {
      try {
        fm.writeImage(localPath, image);
        console.log(`[日志] 图片已缓存到本地：${localPath}`);
      } catch (e) {
        console.log(`[日志] 图片缓存失败：${e}`);
      }
    }
    return image;
  } catch (e) {
    console.log(`[日志] 网络图片加载失败：${e}`);
    return null;
  }
}

// ====== 数据加载 ======
console.log("[日志] 开始加载快递数据...");
let parcels = [];
let unpickedCount = 0;

if (!(await ensureFile(dataPath))) {
  showErrorWidget("缺少 kuaidi.json 文件，请先运行 ExpressData.js 创建文件。");
  return;
}

try {
  let rawData = fm.readString(dataPath);
  if (!rawData) {
    showErrorWidget("kuaidi.json 文件内容为空，请检查文件！");
    return;
  }
  let allParcels = JSON.parse(rawData) || [];
  console.log(`[日志] 读取到快递数据条数：${allParcels.length}`);

  allParcels.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  console.log("[日志] 快递数据已按时间排序");

  unpickedCount = allParcels.filter(p => p.status !== "已取件").length;
  console.log(`[日志] 未取件总数：${unpickedCount}`);

  const maxShow = 5;
  let display = [];
  for (let i = 0; i < allParcels.length && display.length < maxShow; i++) {
    if (allParcels[i].status !== "已取件") {
      display.push(allParcels[i]);
    }
  }
  parcels = display;
  console.log(`[日志] 将在组件中显示快递条数：${parcels.length}`);

} catch (e) {
  showErrorWidget("解析 kuaidi.json 文件失败，请检查文件格式。");
  console.error(e);
  return;
}

// ====== 固定展示逻辑 ======
const maxShow = 5;
let displayParcels = parcels.slice(0, maxShow);
console.log(`[日志] displayParcels 数组长度：${displayParcels.length}`);
let fixedCount = maxShow;

// ====== 布局参数 ======
const widgetWidth = 360;
const widgetHeight = 170;
const paddingLR = 12 * 2;
const spacingMain = 14;
const leftWidth = 120;
const rightWidth = widgetWidth - leftWidth - paddingLR - spacingMain;
const leftHeight = widgetHeight - 24;
const itemSpacing = 1;
const separatorHeight = 3;
const extraTopBottomPadding = 4;
const rightContentOffset = 4;

const totalSpacing = itemSpacing * (fixedCount - 1);
const totalSeparatorHeight = separatorHeight * (fixedCount - 1);
const usableHeight = leftHeight - totalSpacing - totalSeparatorHeight - extraTopBottomPadding * 2;
const singleHeight = Math.floor(usableHeight / fixedCount);
console.log(`[日志] 单条快递显示高度：${singleHeight}`);

const companyFontSize = singleHeight > 50 ? 14 : singleHeight > 40 ? 12 : 10;
const codeFontSize = companyFontSize - 1;
const addrFontSize = Math.max(codeFontSize - 1, 9);

// ====== 创建组件 ======
let w = new ListWidget();
w.backgroundColor = color("#FFFFFF", "#1C1C1E");
w.cornerRadius = 16;
w.setPadding(12, 12, 12, 12);
w.size = new Size(widgetWidth, widgetHeight);

// ==== 没有快递时显示提示 ====
if (parcels.length === 0) {
  console.log("[日志] 没有快递，显示空提示");
  let emptyStack = w.addStack();
  emptyStack.layoutVertically();
  emptyStack.size = new Size(widgetWidth - paddingLR, widgetHeight - 24);
  emptyStack.centerAlignContent();
  emptyStack.addSpacer();

  let row = emptyStack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.addSpacer();

  let emptyText = row.addText("暂时还没有快递信息呢");
  emptyText.font = Font.boldSystemFont(15);
  emptyText.textColor = color("#999999", "#AAAAAA");
  emptyText.centerAlignText();

  row.addSpacer();
  emptyStack.addSpacer();

  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  Script.setWidget(w);
  Script.complete();
  return;
}

console.log("[日志] 有快递，开始渲染组件布局...");

// ====== 左侧 ======
let mainStack = w.addStack();
mainStack.layoutHorizontally();
mainStack.topAlignContent();
mainStack.spacing = spacingMain;

let leftStack = mainStack.addStack();
leftStack.layoutVertically();
leftStack.topAlignContent();
leftStack.size = new Size(leftWidth, leftHeight);

let leftPaddingStack = leftStack.addStack();
leftPaddingStack.layoutHorizontally();
leftPaddingStack.size = new Size(leftWidth, leftHeight);
leftPaddingStack.centerAlignContent();
leftPaddingStack.addSpacer(8);

let leftContentStack = leftPaddingStack.addStack();
leftContentStack.layoutVertically();
leftContentStack.topAlignContent();
leftContentStack.spacing = 8;
leftContentStack.size = new Size(leftWidth - 16, leftHeight);

let titleRow = leftContentStack.addStack();
titleRow.layoutHorizontally();
titleRow.centerAlignContent();
titleRow.spacing = 5;

// ====== 左侧图标加载逻辑（网络优先，iCloud缓存，失败回退表情） ======
let image = null;
if (fm.fileExists(imgPath)) {
  if (fm.isFileStoredIniCloud(imgPath) && !fm.isFileDownloaded(imgPath)) {
    await fm.downloadFileFromiCloud(imgPath);
    console.log("[日志] 本地 iCloud 图片下载完成");
  }
  image = fm.readImage(imgPath);
}

if (!image) {
  image = await loadNetworkImage("https://i.imgs.ovh/2025/08/19/I9H1e.png", imgPath);
}

if (image) {
  let icon = titleRow.addImage(image);
  icon.imageSize = new Size(26, 26);
  console.log("[日志] 左侧图标使用图片显示");
} else {
  let emoji = titleRow.addText("📦");
  emoji.font = Font.systemFont(26);
  console.log("[日志] 左侧图标使用默认📦");
}

let title = titleRow.addText("Express");
title.font = Font.boldSystemFont(15);
title.textColor = color("#333333", "#FFFFFF");

let subTitle = leftContentStack.addText("已到达");
subTitle.font = Font.systemFont(13);
subTitle.textColor = color("#666666", "#CCCCCC");

let countText = leftContentStack.addText(`${unpickedCount} 个`);
countText.font = Font.boldSystemFont(22);
countText.textColor = color("#FF5722", "#FFB74D");

let remindText = leftContentStack.addText("请及时取件！");
remindText.font = Font.systemFont(11);
remindText.textColor = color("#FF9800", "#FFB74D");

leftContentStack.addSpacer(2);
let now = new Date();
let timeText = leftContentStack.addText(
  `上次更新：${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
);
timeText.font = Font.systemFont(9);
timeText.textColor = color("#999999", "#AAAAAA");

// ====== 中间竖线 ======
let dividerStack = mainStack.addStack();
dividerStack.size = new Size(0.5, leftHeight);
dividerStack.backgroundColor = color("#EEEEEE", "#333333");

// ====== 右侧 ======
let rightStack = mainStack.addStack();
rightStack.layoutVertically();
rightStack.topAlignContent();
rightStack.spacing = itemSpacing;
rightStack.size = new Size(rightWidth, leftHeight);
rightStack.clip = true;

rightStack.addSpacer(extraTopBottomPadding);

for (let i = 0; i < fixedCount; i++) {
  if (i < displayParcels.length) {
    let p = displayParcels[i];
    if (!p.status) p.status = "待取件";
    console.log(`[日志] 渲染第 ${i + 1} 条快递：${simplifyCompanyName(p.type || "")}, 取件码: ${p.code || "无"}, 地址: ${p.address || "无"}, 状态: ${p.status}`);

    let parcelStack = rightStack.addStack();
    parcelStack.layoutVertically();
    parcelStack.spacing = 3;
    parcelStack.size = new Size(rightWidth - rightContentOffset, singleHeight);
    parcelStack.setPadding(0, rightContentOffset, 0, 0);

    let topRow = parcelStack.addStack();
    topRow.layoutHorizontally();

    let leftTop = topRow.addStack();
    leftTop.layoutHorizontally();
    leftTop.spacing = 8;
    leftTop.centerAlignContent();

    let company = leftTop.addText(simplifyCompanyName(p.type || ""));
    company.font = Font.boldSystemFont(companyFontSize);
    company.textColor = color("#444444", "#FFFFFF");
    company.lineLimit = 1;
    company.minimumScaleFactor = 0.7;

    let displayCode = p.code ? `取件码: ${p.code}` : "取件码: 无";
    let code = leftTop.addText(displayCode);
    code.font = Font.systemFont(codeFontSize);
    code.textColor = color("#FF5722", "#FFB74D");
    code.lineLimit = 1;
    code.minimumScaleFactor = 0.7;

    topRow.addSpacer();

    let statusColor = p.status === "已取件" ? "#4CAF50" : "#1976D2";
    let status = topRow.addText(p.status);
    status.font = Font.boldSystemFont(codeFontSize);
    status.textColor = color(statusColor, statusColor);
    status.lineLimit = 1;
    status.minimumScaleFactor = 0.7;

    let bottomRow = parcelStack.addStack();
    bottomRow.layoutHorizontally();

    let addrColor = color("#666666", "#CCCCCC");
    let timeFont = Font.systemFont(9);
    let timeColor = color("#999999", "#AAAAAA");

    if (p.address) {
      const addrLength = p.address.length;
      let fontSize = addrFontSize;
      if (addrLength > 20 && addrLength <= 40) fontSize = addrFontSize - 1;
      else if (addrLength > 40) fontSize = Math.max(addrFontSize - 2, 8);

      let addr = bottomRow.addText(p.address);
      addr.font = Font.systemFont(fontSize);
      addr.textColor = addrColor;
      addr.lineLimit = 2;
      addr.minimumScaleFactor = 0.6;
    } else {
      bottomRow.addSpacer();
    }

    bottomRow.addSpacer();

    if (p.time) {
      let dateObj = new Date(p.time);
      if (!isNaN(dateObj)) {
        let hh = pad(dateObj.getHours());
        let mm = pad(dateObj.getMinutes());
        let timeText = bottomRow.addText(`时间 ${hh}:${mm}`);
        timeText.font = timeFont;
        timeText.textColor = timeColor;
        timeText.lineLimit = 1;
        timeText.minimumScaleFactor = 0.7;
      }
    }

    let sepOuter = rightStack.addStack();
    sepOuter.layoutHorizontally();
    sepOuter.size = new Size(rightWidth, separatorHeight);
    sepOuter.addSpacer(rightContentOffset);
    let sep = sepOuter.addImage(createSeparatorImage(rightWidth - 2 * rightContentOffset));
    sep.imageSize = new Size(rightWidth - 2 * rightContentOffset, 1);
    sep.tintColor = color("#EEEEEE", "#333333");
    sepOuter.addSpacer(rightContentOffset);

  } else {
    console.log(`[日志] 第 ${i + 1} 条为空行`);
    let emptyRow = rightStack.addStack();
    emptyRow.size = new Size(rightWidth - rightContentOffset, singleHeight);
    emptyRow.addSpacer();
  }
}

rightStack.addSpacer(extraTopBottomPadding);

// ==== 定时刷新 ====
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
console.log("[日志] 设置组件定时刷新时间为30分钟后");

Script.setWidget(w);
Script.complete();
console.log("[日志] 脚本执行完成，组件已生成");
