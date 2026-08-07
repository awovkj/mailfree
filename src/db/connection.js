/**
 * 数据库连接辅助模块
 * @module db/connection
 */

import { initDatabase } from './init.js';

// 初始化状态标志（Worker 生命周期内共享，避免每次请求重复初始化）
let _dbInitialized = false;

/**
 * 获取数据库连接并验证有效性
 *
 * 注意：D1 绑定对象本身始终可用，真正的连接错误会在首次查询时暴露，
 * 因此这里不再对每个请求执行 `SELECT 1` 健康检查，以减少无谓的数据库往返。
 *
 * @param {object} env - 环境变量对象
 * @returns {Promise<object>} 数据库连接对象
 * @throws {Error} 当数据库未配置时抛出异常
 */
export async function getDatabaseWithValidation(env) {
  const db = env.TEMP_MAIL_DB;
  if (!db) {
    throw new Error('数据库未配置，请检查 wrangler.toml 中的 [[d1_databases]] 绑定');
  }
  return db;
}

/**
 * 获取数据库连接并初始化（仅首次调用时执行初始化）
 * @param {object} env - 环境变量对象
 * @returns {Promise<object>} 初始化后的数据库连接对象
 */
export async function getInitializedDatabase(env) {
  const db = await getDatabaseWithValidation(env);
  if (!_dbInitialized) {
    await initDatabase(db);
    _dbInitialized = true;
  }
  return db;
}
