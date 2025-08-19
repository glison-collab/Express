// ====== 前置准备 ======
let fm = FileManager.iCloud();
let storageFile = fm.joinPath(fm.documentsDirectory(), "kuaidi.json");

// ====== 通用函数 ======
async function ensureFileDownloaded(path) {
  console.log(`[日志] 检查文件是否存在：${path}`);
  if (!fm.fileExists(path)) {
    console.log("[日志] 文件不存在");
    return false;
  }
  if (fm.isFileDownloaded(path)) {
    console.log("[日志] 文件已本地存在，无需下载");
    return true;
  }
  try {
    await fm.downloadFileFromiCloud(path);
    console.log("[日志] 文件下载完成");
    return fm.isFileDownloaded(path);
  } catch (e) {
    console.error("[日志] 下载 iCloud 文件失败", e);
    return false;
  }
}

// ====== Alert / 输出函数 ======
async function showAlert(title, message) {
  if (config.runsInApp) {
    let a = new Alert();
    a.title = title;
    if (message) a.message = message;
    a.addAction("确定");
    await a.present();
  } else {
    Script.setShortcutOutput(message ? `${title}\n${message}` : title);
  }
}

// ====== 读取/保存快递数据 ======
async function loadParcels() {
  let ready = await ensureFileDownloaded(storageFile);
  if (!ready) {
    console.log("[日志] 数据文件不存在或不可用，创建新文件");
    fm.writeString(storageFile, JSON.stringify([]));
    await showAlert("首次运行", "kuaidi.json 文件已创建，请重新运行脚本");
    return [];
  }
  try {
    let raw = fm.readString(storageFile);
    let data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") return [data];
    return [];
  } catch (e) {
    console.error("[日志] 读取快递数据失败", e);
    await showAlert("错误", "读取快递数据失败，返回空列表");
    return [];
  }
}

function saveParcels(list) {
  fm.writeString(storageFile, JSON.stringify(list));
  console.log(`[日志] 保存快递数据，总条目数: ${list.length}`);
}

// ====== 快递解析函数 ======
function parseMessage(msg) {
  const companies = [
    "中通","顺丰","顺丰速运","圆通","申通","韵达","韵达快运","百世","EMS",
    "菜鸟","菜鸟裹裹","菜鸟驿站","京东","京东快递","邮政","天天","德邦"
  ];

  let type = "", code = "", address = "";

  // 快递类型解析
  let companyMatch = msg.match(/[【\[\(](.+?)[】\]\)]/);
  if (companyMatch) {
    let name = companyMatch[1].trim();
    if (name === "菜鸟裹裹") type = "菜鸟";
    else if (name === "菜鸟驿站") type = "驿站";
    else type = name.replace(/(快递|物流|速运|速递|快运|裹裹|快件)$/g, "").trim();
  }
  if (!type) {
    for (let c of companies) {
      if (msg.includes(c)) {
        type = c.replace(/(快递|物流|速运|速递|快运|裹裹|快件)$/g, "").trim();
        break;
      }
    }
  }

  // 取件码解析
  let codeMatch = msg.match(/(?:取件码|验证码|取件密码|提取码|密码|code)[：:\s]*([\w\d\-]{4,20})/i);
  if (codeMatch) code = codeMatch[1].trim();

  // 地址解析
  let addressMatch = msg.match(/(?:至|取件地址[:：]?|地址[:：]?|派送至[:：]?|快件已到|快件到达|请到|地点[:：]?|领取地址[:：]?)([\s\S]+?)(?:取件|领取|请凭码|。|，|,|$)/);
  if (addressMatch) address = addressMatch[1].trim();
  else {
    let locationMatch = msg.match(/(?:取件地点|取件柜)[:：]?([\s\S]+?)(?:取件|地址|。|，|,|$)/);
    if (locationMatch) address = locationMatch[1].trim();
  }

  let time = new Date().toLocaleString();
  console.log(`[日志] 解析快递消息: 类型="${type}", 取件码="${code}", 地址="${address}"`);
  return { type, code, address, time };
}

// ====== 批量导入 ======
async function addParcelsBatch(msg) {
  console.log("[日志] 开始批量导入快递消息");
  let parcels = await loadParcels();
  let msgs = msg.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);

  let addedList = []; // 新增快递类型+取件码列表

  for (let m of msgs) {
    let newData = parseMessage(m);
    if (!newData.type || !newData.code || !newData.address) {
      console.log("[日志] 跳过非法快递信息");
      continue;
    }

    let index = parcels.findIndex(p => p.code === newData.code);
    if (index >= 0) {
      newData.status = parcels[index].status || "待取件";
      parcels[index] = newData;
      console.log(`[日志] 更新快递: ${newData.type} - ${newData.code} [${newData.status}]`);
    } else {
      newData.status = "待取件";
      parcels.push(newData);
      addedList.push(`${newData.type} - ${newData.code}`);
      console.log(`[日志] 新增快递: ${newData.type} - ${newData.code} [${newData.status}]`);
    }
  }

  saveParcels(parcels);

  let msgText = addedList.length > 0
    ? `有新增快递：\n${addedList.join("\n")}`
    : `无新增快递\n当前总数 ${parcels.length} 条`;

  if (config.runsInApp) {
    let n = new Notification();
    n.title = "快递管家";
    n.body = msgText;
    n.sound = "default";
    await n.schedule();
  }

  if (config.runsInShortcut) {
    Script.setShortcutOutput(msgText);
  } else if (!config.runsInApp) {
    await showAlert("提示", msgText);
  } else {
    await showAlert("提示", "快递信息已保存");
  }
}

// ====== 标记状态 ======
async function markParcelStatus() {
  let parcels = await loadParcels();
  if (parcels.length === 0) {
    await showAlert("提示", "暂无快递记录");
    return;
  }

  let selectMenu = new Alert();
  selectMenu.title = "选择要标记状态的快递";
  parcels.forEach(p => selectMenu.addAction(`${p.type} - ${p.code} [${p.status || "待取件"}]`));
  selectMenu.addCancelAction("取消");
  let selectIndex = await selectMenu.presentSheet();

  if (selectIndex >= 0 && selectIndex < parcels.length) {
    let statusMenu = new Alert();
    statusMenu.title = "选择快递状态";
    statusMenu.addAction("待取件");
    statusMenu.addAction("已取件");
    statusMenu.addCancelAction("取消");
    let statusIndex = await statusMenu.presentSheet();

    if (statusIndex === 0 || statusIndex === 1) {
      parcels[selectIndex].status = statusIndex === 0 ? "待取件" : "已取件";
      saveParcels(parcels);
      console.log(`[日志] 快递状态更新: ${parcels[selectIndex].type} - ${parcels[selectIndex].code} -> ${parcels[selectIndex].status}`);
      await showAlert("提示", `快递状态已更新为：${parcels[selectIndex].status}`);
    }
  }
}

// ====== 脚本启动时检查 JSON 文件 ======
let parcelsExist = await ensureFileDownloaded(storageFile);
if (!parcelsExist) {
  fm.writeString(storageFile, JSON.stringify([]));
  await showAlert("首次运行", "kuaidi.json 文件已创建，请重新运行脚本");
  Script.complete();
}

// ====== 入口逻辑 ======
if (typeof args !== "undefined" && args.shortcutParameter) {
  await addParcelsBatch(args.shortcutParameter.replace(/;/g,"\n"));
  Script.complete();
} else {
  console.log("[日志] 进入脚本主菜单");
  let menu = new Alert();
  menu.title = "快递管理";
  menu.addAction("新增快递（多条 ; 分隔导入）");
  menu.addAction("查看历史");
  menu.addAction("删除快递");
  menu.addAction("清空所有");
  menu.addAction("标记快递状态");
  menu.addCancelAction("取消");

  let choice = await menu.presentSheet();
  console.log(`[日志] 菜单选择: ${choice}`);

  if (choice === 0) {
    console.log("[日志] 用户选择新增快递");
    let input = new Alert();
    input.title = "输入多条快递信息（用 ; 分隔）";
    input.addTextField("示例：短信1;短信2;短信3");
    input.addAction("保存");
    input.addCancelAction("取消");
    let res = await input.presentAlert();
    if (res === 0) {
      let rawInput = input.textFieldValue(0).trim();
      console.log("[日志] 输入内容:", rawInput);
      if (!rawInput) {
        console.log("[日志] 输入为空，取消导入");
        await showAlert("提示", "输入为空，导入已取消");
      } else {
        let msgs = rawInput.split(";").map(s => s.trim());
        let validMsgs = msgs.filter(s => {
          let p = parseMessage(s);
          return p.type && p.code && p.address;
        });
        console.log(`[日志] 有效快递数量: ${validMsgs.length}`);
        if (validMsgs.length === 0) {
          await showAlert("提示", "没有合法快递信息，导入已取消");
        } else {
          await addParcelsBatch(validMsgs.join("\n"));
        }
      }
    }
  } else if (choice === 1) {
    console.log("[日志] 用户选择查看历史");
    let list = await loadParcels();
    if (list.length === 0) {
      console.log("[日志] 快递记录为空");
      await showAlert("提示", "暂无快递记录");
    } else {
      let display = list.map((p, i) =>
        `${i + 1}. ${p.type} 取件码:${p.code} [${p.status || "待取件"}]\n${p.address}\n${p.time}`
      ).join("\n\n");
      console.log("[日志] 显示快递历史");
      QuickLook.present(display);
    }
  } else if (choice === 2) {
    console.log("[日志] 用户选择删除快递");
    let list = await loadParcels();
    if (list.length === 0) {
      console.log("[日志] 无快递可删除");
      await showAlert("提示", "暂无快递可删除");
    } else {
      let delMenu = new Alert();
      delMenu.title = "选择要删除的快递";
      list.forEach(p => delMenu.addAction(`${p.type} - ${p.code}`));
      delMenu.addCancelAction("取消");
      let delIndex = await delMenu.presentSheet();
      console.log(`[日志] 删除选择索引: ${delIndex}`);
      if (delIndex >= 0 && delIndex < list.length) {
        console.log(`[日志] 删除快递: ${list[delIndex].type} - ${list[delIndex].code}`);
        list.splice(delIndex, 1);
        saveParcels(list);
        await showAlert("提示", "删除成功");
      }
    }
  } else if (choice === 3) {
    console.log("[日志] 用户选择清空所有快递");
    let confirm = new Alert();
    confirm.title = "确认清空所有快递？";
    confirm.addAction("确认");
    confirm.addCancelAction("取消");
    let confirmRes = await confirm.presentAlert();
    console.log(`[日志] 清空确认结果: ${confirmRes}`);
    if (confirmRes === 0) {
      saveParcels([]);
      console.log("[日志] 所有快递已清空");
      await showAlert("提示", "已清空");
    }
  } else if (choice === 4) {
    console.log("[日志] 用户选择标记快递状态");
    await markParcelStatus();
  } else {
    console.log("[日志] 用户取消操作");
  }
}