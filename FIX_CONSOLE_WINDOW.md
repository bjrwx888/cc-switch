# 控制台窗口自动关闭问题修复指南

## 问题原因

在 `src-tauri/src/commands/claude.rs` 文件中，`create_system_command` 函数设置了 Windows 的 `CREATE_NO_WINDOW` 标志 (0x08000000)，这导致 Claude 进程在启动时无法正常显示窗口或可能立即退出。

## 对比参考项目 K:\opcode

参考项目中的 `create_system_command` 函数**没有**设置这个标志。

## 修复方法

**请手动修改** `src-tauri/src/commands/claude.rs` 文件，找到以下代码（约第 292-313 行）：

```rust
/// Creates a system binary command with the given arguments
fn create_system_command(claude_path: &str, args: Vec<String>, project_path: &str) -> Command {
    let mut cmd = create_command_with_env(claude_path);

    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }

    cmd.current_dir(project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, prevent console window from appearing  <-- 删除这行
    #[cfg(target_os = "windows")]                         <-- 删除这行
    {                                                      <-- 删除这行
        const CREATE_NO_WINDOW: u32 = 0x08000000;         <-- 删除这行
        cmd.creation_flags(CREATE_NO_WINDOW);             <-- 删除这行
    }                                                      <-- 删除这行

    cmd
}
```

**修改为：**

```rust
/// Creates a system binary command with the given arguments
fn create_system_command(claude_path: &str, args: Vec<String>, project_path: &str) -> Command {
    let mut cmd = create_command_with_env(claude_path);

    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }

    cmd.current_dir(project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    cmd
}
```

## 修改后

删除 `CREATE_NO_WINDOW` 相关的6行代码后，重新编译并运行应用：

```bash
pnpm tauri build
```

这样 Claude 进程将能够正常运行，不会因为缺少控制台环境而自动关闭。
