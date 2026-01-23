// myWorker.ts - 线程池工作器脚本
import workerpool from 'workerpool';
import { isTextFile } from './fileCommonUtil';

// 斐波那契数列计算函数（故意使用低效实现来演示多线程优势）
function fibonacci(n: number): number {
  console.log(`计算fibonacci(${n})`,isTextFile('test.txt'));
  if (n < 2) return n;
  return fibonacci(n - 2) + fibonacci(n - 1);
}

// 创建worker并注册公共函数
workerpool.worker({
  fibonacci: fibonacci,
});