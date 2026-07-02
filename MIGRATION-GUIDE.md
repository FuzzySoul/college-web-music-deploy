# 新电脑环境配置指南

## 完整迁移步骤

### 第一步：安装必要软件

#### 1.1 安装 Node.js（>= 18.x）

**Windows:**
1. 访问 https://nodejs.org/
2. 下载 LTS 版本（推荐 20.x 或 18.x）
3. 运行安装程序
4. 重启终端/命令行

**验证安装：**
```powershell
node -v
# 应显示 v18.x.x 或更高版本
```

#### 1.2 安装 pnpm（>= 9.0.0）

```powershell
# 使用 npm 安装
npm install -g pnpm

# 验证安装
pnpm -v
# 应显示 9.0.0 或更高版本
```

---

### 第二步：复制项目文件

将以下文件夹复制到新电脑：

```
f:\code\College Web\projects\
```

---

### 第三步：配置环境变量

**关键步骤！这是最常见的报错原因。**

在 `projects` 文件夹下创建 `.env.local` 文件：

```bash
# 文件路径: projects/.env.local

# Supabase 配置（必须）- 使用项目当前的配置
COZE_SUPABASE_URL=https://ddquqhpbykuhghqdvyeh.supabase.co
COZE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcXVxaHBieWt1aGdocWR2eWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjA4MDQsImV4cCI6MjA4NzUzNjgwNH0.k8f5JqPeUTKTiouBw1n9tUimCNA-k__o-FtH2ZwZTiI

# 客户端配置（必须）
NEXT_PUBLIC_COZE_SUPABASE_URL=https://ddquqhpbykuhghqdvyeh.supabase.co
NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcXVxaHBieWt1aGdocWR2eWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjA4MDQsImV4cCI6MjA4NzUzNjgwNH0.k8f5JqPeUTKTiouBw1n9tUimCNA-k__o-FtH2ZwZTiI
```

**创建方法：**

**方法一：使用记事本**
1. 打开 `projects` 文件夹
2. 右键 → 新建 → 文本文档
3. 命名为 `.env.local`（注意：包括前面的点）
4. 粘贴上面的内容
5. 保存

**方法二：使用命令行**
```powershell
cd "你的 projects 文件夹路径"
notepad .env.local
# 粘贴内容，保存
```

---

### 第四步：安装依赖

打开终端（PowerShell 或 CMD），进入项目目录：

```powershell
# 进入 projects 目录
cd "你的 projects 文件夹路径\projects"

# 清理旧缓存（如果有）
pnpm store prune

# 安装依赖
pnpm install
```

**注意：** 安装过程可能需要几分钟，耐心等待。如果网络慢，可以使用国内镜像：

```powershell
# 设置 pnpm 镜像
pnpm config set registry https://registry.npmmirror.com

# 重新安装
pnpm install
```

---

### 第五步：启动项目

```powershell
# 开发模式启动
pnpm dev
```

启动成功后会显示：
```
  ▲ Next.js 16.1.1
  - Local:        http://localhost:5000
```

在浏览器中打开 http://localhost:5000

---

## 常见报错及解决方案

### 报错 1：`.env.local` 找不到

```
Error: Cannot find file '.../.env.local'
```

**解决方案：** 创建 `.env.local` 文件（见第三步）

---

### 报错 2：模块找不到

```
Module not found: Can't resolve '...'
```

**解决方案：**
```powershell
# 清理并重新安装
rm -rf node_modules
pnpm install
```

---

### 报错 3：pnpm 命令不存在

```
'pnpm' is not recognized as an internal or external command
```

**解决方案：**
```powershell
npm install -g pnpm
```

---

### 报错 4：端口被占用

```
Error: listen EADDRINUSE :::5000
```

**解决方案：**
```powershell
# 查看端口占用
netstat -ano | findstr :5000

# 杀死进程（将 <PID> 替换为实际的进程ID）
taskkill /F /PID <PID>
```

---

### 报错 5：Supabase 连接失败

检查 `.env.local` 中的 URL 和 Key 是否正确配置。

---

## 快速检查清单

在运行 `pnpm dev` 之前，确保：

- [ ] Node.js >= 18.x 已安装
- [ ] pnpm >= 9.0.0 已安装
- [ ] `.env.local` 文件已创建
- [ ] `pnpm install` 已完成
- [ ] 终端在 `projects` 目录下

---

## 获取帮助

如果仍有问题，请告诉我具体的报错信息，我会帮你解决。
