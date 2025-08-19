// ====== Express一键安装脚本 ======
let fm = FileManager.iCloud();
let docsDir = fm.documentsDirectory();

// 文件列表
let files = [
  {
    url: "https://raw.githubusercontent.com/glison-collab/Express/refs/heads/main/ExpressData.js",
    name: "ExpressData.js"
  },
  {
    url: "https://raw.githubusercontent.com/glison-collab/Express/refs/heads/main/Express.js",
    name: "Express.js"
  }
];

// 下载并保存函数（带状态判断和日志）
async function downloadFile(url, fileName) {
  let path = fm.joinPath(docsDir, fileName);
  console.log(`开始处理文件: ${fileName}`);

  if (fm.fileExists(path)) {
    console.log(`${fileName} 已存在，跳过下载`);
    return { name: fileName, status: "exists" };
  }

  try {
    let req = new Request(url);
    let content = await req.loadString();
    fm.writeString(path, content);
    console.log(`${fileName} 下载成功`);
    return { name: fileName, status: "success" };
  } catch (e) {
    console.error(`${fileName} 下载失败: ${e}`);
    return { name: fileName, status: "fail", error: e };
  }
}

// 弹窗提示函数
async function showAlert(title, message) {
  let alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction("确定");
  await alert.present();
}

// 主流程
(async () => {
  let results = [];

  for (let file of files) {
    let result = await downloadFile(file.url, file.name);
    results.push(result);
  }

  // 当两个文件都处理完成后，统一生成提示信息
  let message = results.map(r => {
    switch (r.status) {
      case "success": return `${r.name} 下载成功`;
      case "exists": return `${r.name} 已存在，未下载`;
      case "fail": return `${r.name} 下载失败: ${r.error}`;
    }
  }).join("\n");

  message += "\n\n组件已安装，请退出安装脚本";

  console.log("下载结果总结：\n" + message);

  await showAlert("安装完成", message);
})();
