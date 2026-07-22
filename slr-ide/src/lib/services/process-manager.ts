import { spawn, execSync, ChildProcess, SpawnOptions } from 'child_process';

export class ProcessManager {
  private static instance: ProcessManager;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  public spawnProcess(command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
    const child = spawn(command, args, options);
    const globalState = (global as any);
    if (globalState.batchState) {
      globalState.batchState.activeChild = child;
    }
    return child;
  }

  public terminateProcessTree(): boolean {
    const globalState = (global as any);
    const state = globalState.batchState;
    if (state && state.activeChild) {
      console.log(`Killing active child process PID ${state.activeChild.pid} via ProcessManager...`);
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${state.activeChild.pid} /T /F`);
        } else {
          state.activeChild.kill('SIGKILL');
        }
        state.activeChild = null;
        return true;
      } catch (e) {
        console.error('Error killing child process:', e);
        return false;
      }
    }
    return false;
  }

  public isProcessRunning(): boolean {
    const globalState = (global as any);
    return !!(globalState.batchState && globalState.batchState.activeChild);
  }

  public getActiveChild(): ChildProcess | null {
    const globalState = (global as any);
    return globalState.batchState ? globalState.batchState.activeChild : null;
  }
}

export const processManager = ProcessManager.getInstance();
