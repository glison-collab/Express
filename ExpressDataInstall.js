Script.Installer = async () => {
  let fm = FileManager.iCloud();
  let dir = fm.documentsDirectory();
  let url = "https://raw.githubusercontent.com/glison-collab/Express/refs/heads/main/ExpressData.js";
  let code = await new Request(url).loadString();
  fm.writeString(fm.joinPath(dir, "ExpressData.js"), code);
  console.log("✅ ExpressData.js 安装完成");
};
