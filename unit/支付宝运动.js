let { config } = require('../config.js')(runtime, global)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, global)
let commonFunctions = singletonRequire('CommonFunction')
let widgetUtils = singletonRequire('WidgetUtils')
let automator = singletonRequire('Automator')
let FloatyInstance = singletonRequire('FloatyUtil')
let logFloaty = singletonRequire('LogFloaty')
let runningQueueDispatcher = singletonRequire('RunningQueueDispatcher')
config.buddha_like_mode = false
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog, debugForDev, clearLogFile, flushAllLogs } = singletonRequire('LogUtils')
config.not_lingering_float_window = true
logInfo('======加入任务队列，并关闭重复运行的脚本=======')
runningQueueDispatcher.addRunningTask()

// 注册自动移除运行中任务
commonFunctions.registerOnEngineRemoved(function () {
  if (config.auto_lock === true && unlocker.needRelock() === true) {
    debugInfo('重新锁定屏幕')
    automator.lockScreen()
    unlocker.saveNeedRelock(true)
  }
  config.resetBrightness && config.resetBrightness()
  debugInfo('校验并移除已加载的dex')
  // 移除运行中任务
  runningQueueDispatcher.removeRunningTask(true, false,
    () => {
      // 保存是否需要重新锁屏
      unlocker.saveNeedRelock()
      config.isRunning = false
    }
  )
}, 'main')
if (!commonFunctions.ensureAccessibilityEnabled()) {
  errorInfo('获取无障碍权限失败')
  exit()
}
let unlocker = require('../lib/Unlock.js')
unlocker.exec()

let patrol = new Patrol()
patrol.exec()

function Patrol () {
  function startApp (reopen) {
    app.startActivity({
      action: 'VIEW',
      data: 'alipays://platformapi/startapp?appId=2019072565980504',
      packageName: config.package_name
    })
    FloatyInstance.setFloatyInfo({ x: config.device_width / 2, y: config.device_height / 2 }, "查找是否有'打开'对话框")
    let confirm = widgetUtils.widgetGetOne(/^打开$/, 1000)
    if (confirm) {
      automator.clickRandom(confirm)
    }
    if (openAlipayMultiLogin(reopen)) {
      return
    }
    if (config.is_alipay_locked) {
      sleep(1000)
      alipayUnlocker.unlockAlipay()
    }
    if (widgetUtils.widgetWaiting('.*保护地', null, 2000)) {
      return true
    }
    warnInfo(['无法校验 保护地 控件，可能没有正确打开'], true)
    return false
  }

  function openAlipayMultiLogin (reopen) {
    if (config.multi_device_login && !reopen) {
      debugInfo(['已开启多设备自动登录检测，检查是否有 进入支付宝 按钮'])
      let entryBtn = widgetUtils.widgetGetOne(/^进入支付宝$/, 1000)
      if (entryBtn) {
        let storage = storages.create("alipay_multi_login")
        let multiLoginFlag = storage.get("flag")
        let multiLoginTime = storage.get("timestamp") 
        let currentTime = new Date().getTime()
        let waitMin = 10
        if (!multiLoginFlag) {
          debugInfo('检测到其他设备登录,记录时间并设置10分钟后重试')
          FloatyInstance.setFloatyText('检测到其他设备登录，将在10分钟后重试')
          storage.put("flag", true)
          storage.put("timestamp", currentTime)
          commonFunctions.setUpAutoStart(waitMin)
          exit()
        } else if (currentTime - multiLoginTime >= waitMin * 60 * 1000) {
          debugInfo('已等待10分钟,点击进入支付宝')
          FloatyInstance.setFloatyText('等待完成，正在重新登录支付宝')
          automator.clickRandom(entryBtn)
          sleep(1000)
          return true
        } else {
          let remainMinutes = Math.ceil((waitMin * 60 * 1000 - (currentTime - multiLoginTime)) / (60 * 1000))
          debugInfo('等待时间未到10分钟,设置剩余时间后重试')
          FloatyInstance.setFloatyText('需要等待' + remainMinutes + '分钟后重试')
          commonFunctions.setUpAutoStart(remainMinutes)
          exit()
        }
      } else {
        debugInfo(['未找到 进入支付宝 按钮'])
      }
    }
  }

  this.openForest = function () {
    startApp()
  }

  this.exec = function () {
    let endIdx = logFloaty.logQueue._innerList.length - 1
    logFloaty.pushLog('测试日志')
    logFloaty.pushLog('测试日志')
    logFloaty.pushLog('测试日志')
    logFloaty.pushLog('测试日志')
    logFloaty.pushLog('测试日志')
    logFloaty.pushLog('观看视频，等待15秒')
    let count = 15
    while (count-- > 0) {
      logFloaty.replaceLastLog('观看视频，等待' + count + '秒')
      sleep(1000)
    }
    sleep(1000)
    WarningFloaty.clearAll()
    // this.openForest()
    // debugInfo(['开始签到领币'])
    // // do。。。
    // debugInfo(['巡护结束'])
    // commonFunctions.minimize()
    exit()
  }

}
