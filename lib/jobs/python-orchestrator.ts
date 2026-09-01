/**
 * Python Worker Orchestrator
 * Manages calls to Python ML workers for Phase 5 components
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from '@/lib/logging';

const execAsync = promisify(exec);

export type PythonJobType =
  | 'forecast_emissions'
  | 'explain_emissions'
  | 'analyze_root_cause'
  | 'process_batch_job';

export interface PythonJobResult {
  success: boolean;
  jobType: PythonJobType;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export class PythonOrchestrator {
  private static pythonPath = process.env.PYTHON_PATH || 'python3';
  private static workersDir = path.join(process.cwd(), 'workers');

  /**
   * Execute Python worker with arguments
   */
  private static async executeWorker(
    scriptName: string,
    args: string[]
  ): Promise<PythonJobResult> {
    const scriptPath = path.join(this.workersDir, scriptName);
    const command = `${this.pythonPath} "${scriptPath}" ${args.map((a) => `"${a}"`).join(' ')}`;

    try {
      logger.info(`Executing Python worker: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 5 * 60 * 1000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn(`Python worker stderr: ${stderr}`);
      }

      return {
        success: true,
        jobType: 'forecast_emissions',
        stdout,
        stderr,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Python worker execution failed: ${errorMessage}`);

      return {
        success: false,
        jobType: 'forecast_emissions',
        error: errorMessage,
      };
    }
  }

  /**
   * Queue a forecast job (Phase 5A)
   */
  static async queueForecast(
    orgId: string,
    facilityId: string,
    categoryId: string
  ): Promise<PythonJobResult> {
    return this.executeWorker('phase5a_forecasting.py', [
      orgId,
      facilityId,
      categoryId,
    ]);
  }

  /**
   * Queue an explainability job (Phase 5B)
   */
  static async queueExplanation(
    orgId: string,
    emissionCalculationId: string
  ): Promise<PythonJobResult> {
    return this.executeWorker('phase5b_explainability.py', [
      orgId,
      emissionCalculationId,
    ]);
  }

  /**
   * Queue a root cause analysis job (Phase 5C)
   */
  static async queueRootCauseAnalysis(
    orgId: string,
    facilityId: string
  ): Promise<PythonJobResult> {
    return this.executeWorker('phase5c_root_cause.py', [orgId, facilityId]);
  }

  /**
   * Queue a batch job (Phase 5D)
   */
  static async queueBatchJob(
    orgId: string,
    jobType: 'forecast_generation' | 'explanation_generation' | 'causal_analysis'
  ): Promise<PythonJobResult> {
    return this.executeWorker('phase5d_distributed.py', [orgId, jobType]);
  }

  /**
   * Check if Python environment is available
   */
  static async checkPythonEnvironment(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.pythonPath} --version`);
      logger.info(`Python environment available: ${stdout.trim()}`);
      return true;
    } catch (error) {
      logger.error(`Python environment check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if required packages are installed
   */
  static async checkRequiredPackages(): Promise<{
    available: boolean;
    missing: string[];
  }> {
    const requiredPackages = [
      'prophet',
      'pandas',
      'numpy',
      'sklearn',
      'shap',
      'dowhy',
      'dask',
    ];

    const missing: string[] = [];

    for (const pkg of requiredPackages) {
      try {
        await execAsync(`${this.pythonPath} -c "import ${pkg}"`);
      } catch {
        missing.push(pkg);
      }
    }

    if (missing.length > 0) {
      logger.warn(`Missing Python packages: ${missing.join(', ')}`);
      logger.info('Install with: pip install -r requirements.txt');
    }

    return {
      available: missing.length === 0,
      missing,
    };
  }
}

export default PythonOrchestrator;
