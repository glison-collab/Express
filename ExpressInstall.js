Script.Installer = async () => {
  let fm = FileManager.iCloud();
  let dir = fm.documentsDirectory();
  let url = "https://raw.githubusercontent.com/glison-collab/Express/refs/heads/main/Express.js";
  let code = await new Request(url).loadString();
  fm.writeString(fm.joinPath(dir, "Express.js"), code);
  console.log("✅ Express.js 安装完成");
};
