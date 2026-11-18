在Pi Agent中同样支持`AGENTS.md`、`CLAUDE.md`等等，他的加载机制相关的几个问题记录：


### AGENTS.md 什么时候被读

下面这些情况下会加载AGENTS.md:

启动、新建会话、/reload、ctx.setActiveTools() 等触发重载的时机。

读进来后原文不动（只去 BOM），放进系统提示的 project_context 段。

系统提示段有 diff 增量机制，只影响第一轮和变更轮。所以：AGENTS.md 改完不会自动生效，需要 /reload 或新会话。


### 加载范围

同目录按照下面顺序（前面的优先）只取一个：

```TypeScript
// core/resource-loader.js
const candidates = ["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];
```

跨目录的按照下面顺序叠加：

```text
~/.pi/agent/AGENTS.md          ← 全局，最先
/Users/user-name/AGENTS.md    ← 祖先逐级
/Users/user-name/Documents/AGENTS.md
…/project-name/AGENTS.md        ← 项目目录，最后
```

### 如果文档中有其他文档的指向不会被展开

全量读入，没有任何解析——不找链接、不找 @、不找 include。


### 其他文档指向如何加载

Pi本身没有处理机制，只是把 AGENTS.md 原文塞进系统提示，剩下的交给模型，所以尽量写好引用文档的用途说明。

和Skills的加载机制雷同，都不是程序的判断，是大模型自己的选择。区别只是 Skills 的 description 是结构化的、在系统提示里有固定位置；AGENTS.md 里的链接只是散落在正文中的自然语言。

推荐的写法：
- 指令形："改 src/routes/ 之前，先读 docs/routing.md"
- 带用途："术语表见 GLOSSARY.md（改命名前必读）"
- 尽量强调，很多时候模型会觉得“我现在知道的够多了”

不推荐的写法：
- 没有触发条件："详见 docs/foo.md"
- AGENTS.md内容很长，链接被埋没、稀释
- 意图模糊

如果被判定要读取，实际读取动作是模型调用 read 工具（或 bash 里的 cat），内容会以tool call的类型塞进会话列表。

**有个容易被忽略的问题**

**read 的相对路径是按会话的 cwd 解析的，不是按 AGENTS.md 所在目录解析的。**

- AGENTS.md 在项目根、链接写 docs/api.md、cwd 也是项目根 → 正常。
- AGENTS.md 在父目录或全局 ~/.pi/agent/ 下、链接写相对路径 → 直接传给 read 会解析到 cwd 下的同名路径，有可能会被读错。

Pi有一个处理机制，他会把链接引用处理成如下结果：

```text
<project_context>
Project-specific instructions and guidelines:

<project_instructions path="/Users/jiangjiang/Documents/ai-host/pi-chat-box/AGENTS.md">
# 项目说明

架构见 docs/architecture.md，术语见 GLOSSARY.md。
</project_instructions>
</project_context>
```
`path`中标明了AGENTS.md的绝对位置，聪明的模型会去寻找，这是靠模型补救，不是保证。

所以，可以这样写：

```text
# 写清相对于什么
架构说明：`docs/architecture.md`（路径相对于仓库根目录）

# 写成显式相对
架构说明：`../../docs/architecture.md`（相对于本文件）
```

