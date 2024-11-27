let { config } = require('../config.js')(runtime, global)
// config.buddha_like_mode = false
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, global)
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog, debugForDev, clearLogFile, flushAllLogs } = singletonRequire('LogUtils')
let floatyInstance = singletonRequire('FloatyUtil')
floatyInstance.enableLog()
let commonFunctions = singletonRequire('CommonFunction')
let widgetUtils = singletonRequire('WidgetUtils')
let automator = singletonRequire('Automator')
let YoloTrainHelper = singletonRequire('YoloTrainHelper')
let YoloDetectionUtil = singletonRequire('YoloDetectionUtil')
let runningQueueDispatcher = singletonRequire('RunningQueueDispatcher')
logInfo('======加入任务队列，并关闭重复运行的脚本=======')
runningQueueDispatcher.addRunningTask()

let alipayUnlocker = singletonRequire('AlipayUnlocker')
let TouchController = require('../lib/TouchController.js')
let AiUtil = require('../lib/AIRequestUtil.js')
let logFloaty = singletonRequire('LogFloaty')
let warningFloaty = singletonRequire('WarningFloaty')
let NotificationHelper = singletonRequire('Notification')
let ocrUtil = require('../lib/LocalOcrUtil.js')
let formatDate = require('../lib/DateUtil.js')
// 神奇海洋专用通知id
const NOTIFICATION_ID = config.notificationId * 10 + 2
infoLog(['当前使用的OCR类型为：{} 是否启用：{}', ocrUtil.type, ocrUtil.enabled])
let unlocker = require('../lib/Unlock.js')
// 回收图像资源
let resourceMonitor = require('../lib/ResourceMonitor.js')(runtime, global)
let SCALE_RATE = config.scaleRate
let cvt = (v) => parseInt(v * SCALE_RATE)
config.not_lingering_float_window = true
config.sea_ball_region = config.sea_ball_region || [cvt(860), cvt(1350), cvt(140), cvt(160)]

// 注册自动移除运行中任务
commonFunctions.registerOnEngineRemoved(function () {
  if (config.auto_lock === true && unlocker.needRelock() === true) {
    debugInfo('重新锁定屏幕')
    automator.lockScreen()
    unlocker.saveNeedRelock(true)
  }
  config.resetBrightness && config.resetBrightness()
  debugInfo('校验并移除已加载的dex')
  if (typeof destoryPool != 'undefined') {
    destoryPool()
  }
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
let shizukuSupport = true
if (!config.force_sea_auto_click) {
  if (typeof $shizuku == 'undefined') {
    errorInfo('当前版本不支持shizuku')
    shizukuSupport = false
  } else if (!$shizuku.isRunning()) {
    errorInfo('当前shizuku未运行 无法执行shizuku点击')
    shizukuSupport = false
  }
  if (!shizukuSupport) {
    errorInfo('请在神奇海洋设置中关闭3D模式，否则无法执行点击操作', true)
  }
} else {
  shizukuSupport = false
  warnInfo(['当前强制使用无障碍点击，不使用shizuku，请确保在神奇海洋设置中关闭3D模式，否则无法执行点击操作'])
}



let executeArguments = Object.assign({}, engines.myEngine().execArgv)
let executeByTimeTask = !!executeArguments.intent
// 部分设备中参数有脏东西 可能导致JSON序列化异常
delete executeArguments.intent
if (executeArguments) {
  debugInfo(['启动参数：{}', JSON.stringify(executeArguments)])
}
if (executeArguments.change_auto_start) {
  // 修改自启动脚本，避免参数丢失
  config._force_auto_start_script = executeArguments.change_auto_start
}

unlocker.exec()
commonFunctions.listenDelayStart()
commonFunctions.requestScreenCaptureOrRestart()

function execMiracleOcean() {
  if (!startApp()) {
    warnInfo(['打开项目失败，5分钟后重新尝试'])
    commonFunctions.setUpAutoStart(5)
    return false
  }
  // if (!executeArguments.find_friend_trash) {
    checkNext()
  // }
  findTrashs()
  // 查找好友垃圾
  if (executeArguments.find_friend_trash) {
    config.collecting_friends = true
    collectFriends()
  }
  if (executeArguments.collect_reward) {
    collectRewards()
  }
  commonFunctions.minimize()
  exit()
}

if (executeByTimeTask || executeArguments.executeByDispatcher) {
  if (!(executeArguments.find_friend_trash || executeArguments.collect_reward)) {
    commonFunctions.showCommonDialogAndWait('神奇海洋收垃圾')
  }
  execMiracleOcean()
} else {
  importClass(android.graphics.drawable.GradientDrawable)
  importClass(android.graphics.drawable.RippleDrawable)
  importClass(android.content.res.ColorStateList)
  importClass(java.util.concurrent.LinkedBlockingQueue)
  importClass(java.util.concurrent.ThreadPoolExecutor)
  importClass(java.util.concurrent.TimeUnit)
  importClass(java.util.concurrent.ThreadFactory)
  importClass(java.util.concurrent.Executors)
  let threadPool = new ThreadPoolExecutor(2, 2, 60, TimeUnit.SECONDS, new LinkedBlockingQueue(16),
    new ThreadFactory({
      newThread: function (runnable) {
        let thread = Executors.defaultThreadFactory().newThread(runnable)
        thread.setName('sea-operator-' + thread.getName())
        return thread
      }
    })
  )
  function destoryPool () {
    threadPool && threadPool.shutdown()
  }
  let data = {
    _clickExecuting: false,
    set clickExecuting (val) {
      threadPool.execute(function () {
        if (val) {
          logFloaty.logQueue.push('点击执行中，请稍等', '#888888')
        } else {
          logFloaty.logQueue.push('执行完毕', '#888888')
        }
      })
      this._clickExecuting = val
    },
    get clickExecuting () {
      return this._clickExecuting
    },
    btnDrawables: {}
  }
  config.collecting_friends = false
  // 启动UI形式，支持手动执行更多功能
  let btns = [
    {
      id: 'auto_execute',
      text: '自动执行并设置定时任务',
      textSize: 6,
      onClick: function () {
        checkNext()
        findTrashs(null)
        threads.start(function () { sleep(500); exit() })
        threads.start(function () { sleep(500); exit() })
      }
    }, {
      id: 'find_trashs',
      text: '收垃圾',
      onClick: function () {
        findTrashs(null, true)
      }
    }, {
      id: 'collect_friends',
      text: '收取好友垃圾',
      onClick: () => {
        ui.run(() => {
          window.collect_friends.setText('停止收取')
        })
        if (config.collecting_friends) {
          config.collecting_friends = false
          return
        }
        config.collecting_friends = true
        collectFriends()
        config.collecting_friends = false
        ui.run(() => {
          window.collect_friends.setText('收取好友垃圾')
          changeButtonStyle('collect_friends', null, '#3FBE7B')
        })
      },
      // 点击执行中时，触发终止
      handleExecuting: () => {
        if (config.collecting_friends) {
          ui.run(() => {
            window.collect_friends.setText('等待停止')
            changeButtonStyle('collect_friends', null, '#FF753A')
          })
          config.collecting_friends = false
        }
      }
    }, {
      id: 'check_next',
      text: '识别倒计时',
      onClick: function () {
        ui.run(() => {
          window.setPosition(config.device_width, config.device_height * 0.5)
        })
        checkNext(1, true)
        ui.run(() => {
          window.setPosition(config.device_width * 0.1, config.device_height * 0.5)
        })
      }
    },
    {
      id: 'ai_answer',
      text: 'AI答题',
      onClick: function () {
        logFloaty.pushLog('请手动打开答题界面再执行，否则无法识别答案')
        if (!config.kimi_api_key) {
          logFloaty.pushLog('推荐去KIMI开放平台申请API Key并在可视化配置中进行配置')
          logFloaty.pushLog('否则免费接口这个智障AI经常性答错')
        }
        AiUtil.getQuestionInfo(config.ai_type, config.kimi_api_key)
      }
    },
    {
      id: 'exit',
      color: '#EB393C',
      rippleColor: '#C2292C',
      text: '退出脚本',
      onClick: function () {
        exit()
      }
    }
  ]

  let window = floaty.rawWindow(
    `<horizontal>
    <vertical padding="1">
   ${btns.map(btn => {
      return `<vertical padding="1"><button id="${btn.id}" text="${btn.text}" textSize="${btn.textSize ? btn.textSize : 12}sp" w="*" h="30" marginTop="5" marginBottom="5" /></vertical>`
    }).join('\n')
    }</vertical>
  </horizontal>`)

  function setButtonStyle (btnId, color, rippleColor) {
    let shapeDrawable = new GradientDrawable();
    shapeDrawable.setShape(GradientDrawable.RECTANGLE);
    // 设置圆角大小，或者直接使用setCornerRadius方法
    // shapeDrawable.setCornerRadius(20); // 调整这里的数值来控制圆角的大小
    let radius = util.java.array('float', 8)
    for (let i = 0; i < 8; i++) {
      radius[i] = 20
    }
    shapeDrawable.setCornerRadii(radius); // 调整这里的数值来控制圆角的大小
    shapeDrawable.setColor(colors.parseColor(color || '#3FBE7B')); // 按钮的背景色
    shapeDrawable.setPadding(10, 10, 10, 10); // 调整这里的数值来控制按钮的内边距
    // shapeDrawable.setStroke(5, colors.parseColor('#FFEE00')); // 调整这里的数值来控制按钮的边框宽度和颜色
    data.btnDrawables[btnId] = shapeDrawable
    let btn = window[btnId]
    btn.setShadowLayer(10, 5, 5, colors.parseColor('#888888'))
    btn.setBackground(new RippleDrawable(ColorStateList.valueOf(colors.parseColor(rippleColor || '#27985C')), shapeDrawable, null))
  }

  function changeButtonStyle (btnId, handler, color, storkColor) {
    handler = handler || function (shapeDrawable) {
      color && shapeDrawable.setColor(colors.parseColor(color))
      storkColor && shapeDrawable.setStroke(5, colors.parseColor(storkColor))
    }
    handler(data.btnDrawables[btnId])
  }

  ui.run(() => {
    window.setPosition(config.device_width * 0.1, config.device_height * 0.5)
  })
  btns.forEach(btn => {
    ui.run(() => {
      if (typeof btn.render == 'function') {
        btn.render(window[btn.id])
      } else {
        setButtonStyle(btn.id, btn.color, btn.rippleColor)
      }
    })
    if (btn.onClick) {
      window[btn.id].on('click', () => {
        // region 点击操作执行中，对于collect_friends触发终止，等待执行结束
        if (data.clickExecuting) {
          if (btn.handleExecuting) {
            btn.handleExecuting()
            return
          }
          threadPool.execute(function () {
            logFloaty.pushLog('点击执行中，请稍等')
          })
          return
        }
        data.clickExecuting = true
        // endregion
        threadPool.execute(function () {
          try {
            btn.onClick()
          } catch (e) {
            errorInfo(['点击执行异常：{} {}', e, e.message], true)
          } finally {
            data.clickExecuting = false
          }
        })
      })
    }
  })

  window.exit.setOnTouchListener(new TouchController(window, () => {
    exit()
  }, () => {
    changeButtonStyle('exit', null, '#FF753A', '#FFE13A')
  }, () => {
    changeButtonStyle('exit', (drawable) => {
      drawable.setColor(colors.parseColor('#EB393C'))
      drawable.setStroke(0, colors.parseColor('#3FBE7B'))
    })
  }).createListener())

  startApp()

}

let _floaty_failed_time = 0
function alipayInFloatyWindow () {
  if (_floaty_failed_time >= 3) {
    return false
  }
  sleep(1000)
  let navBar = widgetUtils.widgetGetById('.*navigationBarBackground', 1000)
  if (navBar) {
    let barWidth = navBar.bounds().width()
    debugInfo(['当前导航条宽度：{} id:{}', barWidth, navBar.id()])
    if (barWidth < config.device_width) {
      _floaty_failed_time++
      return true
    }
  } else {
    debugInfo(['未找到导航条，无法验证'])
  }
  return false
}

function openAlipayMultiLogin (reopen) {
  if (config.multi_device_login && !reopen) {
    debugInfo(['已开启多设备自动登录检测，检查是否有 进入支付宝 按钮'])
    let entryBtn = widgetUtils.widgetGetOne(/^进入支付宝$/, 1000)
    if (entryBtn) {
      floatyInstance.setFloatyText('其他设备正在登录，等待5分钟后进入')
      commonFunctions.waitForAction(300, '等待进入支付宝')
      unlocker && unlocker.exec()
      automator.clickRandom(entryBtn)
      sleep(1000)
      return true
    } else {
      debugInfo(['未找到 进入支付宝 按钮'])
    }
  }
}

function startApp(reopen) {
  let screenOrientation = context.getResources().getConfiguration().orientation
  debugInfo(['当前屏幕朝向：{}', screenOrientation])
  if (screenOrientation == 0) {
    warnInfo(['当前屏幕为横向，为避免出现问题，回到桌面再执行'])
    home()
  }
  
  logInfo('准备打开神奇海洋')
  commonFunctions.backHomeIfInVideoPackage()
  commonFunctions.backHomeIfInVideoPackage()
  app.startActivity({
    action: 'VIEW',
    data: 'alipays://platformapi/startapp?appId=2021003115672468',
    packageName: config.package_name
  })

  floatyInstance.setFloatyInfo({ x: config.device_width / 2, y: config.device_height / 2 }, "查找是否有'打开'对话框")
  let startTime = new Date().getTime()
  let limitTime = 30000
  while (new Date().getTime() - startTime < limitTime) {
    let confirm = widgetUtils.widgetGetOne(/^打开$/, 1000)
    if (confirm) {
      automator.clickRandom(confirm)
    }
    if (alipayInFloatyWindow()) {
      warnInfo(['当前为小窗模式，回到桌面重新打开'])
      home()
      return startApp()
    }
    if (openAlipayMultiLogin(reopen)) {
      return startApp(true)
    }
    if (config.is_alipay_locked) {
      alipayUnlocker.unlockAlipay()
      sleep(1000)
    }

    if (isInProjectUI(1000)) {
      floatyInstance.setFloatyText('已进入神奇海洋')
      return true
    }
    
    sleep(1000)
  }

  warnInfo(['打开神奇海洋检测超时'])
  return false
}

function findTrashs (delay, onceOnly, friend) {
  let temp_img = null
  floatyInstance.setFloatyInfo({ x: config.device_width / 2, y: config.device_height / 2 }, '找垃圾球中...')
  sleep(delay || 3000)
  let screen = commonFunctions.checkCaptureScreenPermission()
  if (screen) {
    temp_img = images.copy(screen, true)
    let findBalls = doFindTrashs(screen)
    debugInfo(['找到的球：{}', JSON.stringify(findBalls)])
    if (!friend) {
      let energyBalls = findBalls.filter(ball => ball.label == 'collect')
      if (energyBalls && energyBalls.length > 0) {
        debugInfo(['找到能量球：{}', JSON.stringify(energyBalls)])
        energyBalls.forEach(ball => {
          clickPoint(ball.x + ball.width / 2, ball.y + ball.height / 2)
          sleep(100)
        })
      }
    }
    warningFloaty.clearAll()
    if (YoloDetectionUtil.enabled) {
      findBalls = findBalls.filter(ball => ball.label == 'sea_garbage')
    }
    if (findBalls && findBalls.length > 0) {
      // config.save_yolo_train_data = true
      YoloTrainHelper.saveImage(temp_img, '有垃圾球', 'sea_ball', config.sea_ball_train_save_data)
      temp_img.recycle()
      let ball = findBalls[0]
      floatyInstance.setFloatyInfo({ x: ball.x, y: ball.y }, '找到了垃圾')
      sleep(500)
      if (!YoloDetectionUtil.enabled) {
        let clickPos = { x: ball.x - ball.radius * 1.5, y: ball.y + ball.radius * 1.5 }
        floatyInstance.setFloatyInfo(clickPos, '点击位置')
        sleep(2000)
        clickPoint(clickPos.x, clickPos.y)
      } else {
        floatyInstance.setFloatyInfo({ x: ball.centerX, y: ball.centerY }, '点击位置')
        clickPoint(ball.centerX, ball.centerY)
      }
      sleep(1000)
      let collect = widgetUtils.widgetGetOne('.*(清理|收下|(欢迎|迎回).*伙伴|.*不.*了.*).*')
      if (collect) {
        clickPoint(collect.bounds().centerX(), collect.bounds().centerY())
        if (!onceOnly) {
          // 二次校验
          findTrashs(1500)
        }
      }
      return true
    } else {
      floatyInstance.setFloatyText('未找到垃圾球')
      YoloTrainHelper.saveImage(temp_img, '无垃圾球', 'sea_ball', config.sea_ball_train_save_data)
      temp_img.recycle()
    }
  }
  return false
}

function collectFriends (retry) {
  if (!config.collecting_friends) {
    logFloaty.pushLog('停止执行')
    return
  }
  logFloaty.pushLog('准备收取好友垃圾')
  let btn = findStrollBtn()
  if (btn) {
    YoloTrainHelper.saveImage(commonFunctions.captureScreen(), '找到拼图按钮', 'sea_ball_friend', config.sea_ball_train_save_data)
    logFloaty.pushLog('找到拼图按钮')
    floatyInstance.setFloatyInfo({ x: btn.x, y: btn.y }, '点击拼图按钮')
    clickPoint(btn.x, btn.y)
    sleep(1000)
    if (!widgetUtils.widgetWaiting('今日.*已达.*上限','清理次数上限', 2000)) {
      waitForStrollBtn()
      if (findTrashs(1000, true, true)) {
        sleep(1000)
        return collectFriends()
      } else {
        logFloaty.pushLog('查找拼图失败，可能已经没有机会了')
      }
    }
  } else {
    YoloTrainHelper.saveImage(commonFunctions.captureScreen(), '未找到拼图按钮', 'sea_ball_friend', config.sea_ball_train_save_data)
    logFloaty.pushErrorLog('未找到拼图按钮')
  }
  let backHome = widgetUtils.widgetGetOne(/^回到我的海洋$/, 1000)
  if (backHome) {
    logFloaty.pushLog('点击回到我的海洋')
    floatyInstance.setFloatyInfo({ x: backHome.bounds().centerX(), y: backHome.bounds().centerY() }, '点击回到我的海洋')
    clickPoint(backHome.bounds().centerX(), backHome.bounds().centerY())
    sleep(1000)
  } else if (!retry) {
    logFloaty.pushLog('未识别到回到我的海洋按钮，尝试再次识别垃圾球')
    return collectFriends(true)
  } else {
    logFloaty.pushLog('二次识别垃圾球失败, 退出执行')
  }
}

function clickPoint (x, y) {
  if (shizukuSupport) {
    x = parseInt(x)
    y = parseInt(y)
    debugInfo(['shizuku点击：{}, {}', x, y])
    $shizuku(`input tap ${x} ${y}`)
  } else {
    automator.clickPointRandom(x, y)
  }
}

function checkNext (tryTime, checkOnly) {
  tryTime = tryTime || 1
  if (!ocrUtil.enabled) {
    if (new Date().getHours() < 21) {
      warnInfo('当前版本AutoJS不支持本地OCR，直接设置两小时后的定时任务，此方式并不准确请手动设置实际定时时间，每天间隔两小时的定时任务 并注释下面自动设置定时任务的代码')
      commonFunctions.setUpAutoStart(120)
      NotificationHelper.createNotification('神奇海洋收集两小时后执行', '当前版本不支持OCR识别，直接设置两小时后执行，执行时间：' + buildNextTime(120), NOTIFICATION_ID)
      NotificationHelper.createNotification('神奇海洋收集两小时后执行', '当前版本不支持OCR识别，直接设置两小时后执行，执行时间：' + buildNextTime(120), NOTIFICATION_ID)
    }
    return
  }
  warningFloaty.disableTip()
  let ocrRegion = getOcrRegionByYolo() || [config.sea_ocr_left, config.sea_ocr_top, config.sea_ocr_width, config.sea_ocr_height]
  floatyInstance.setFloatyInfo({ x: ocrRegion[0], y: ocrRegion[1] - 100 }, '识别倒计时中...')
  sleep(500)
  let screen = commonFunctions.checkCaptureScreenPermission()
  let recognizeFailed = true
  if (screen) {
    debugInfo(['ocr识别区域：{}', JSON.stringify(ocrRegion)])
    screen = images.inRange(images.grayscale(screen), '#BEBEBE', '#ffffff')
    let clip = images.clip(screen, ocrRegion[0], ocrRegion[1], ocrRegion[2], ocrRegion[3])
    if (config.develop_mode) {
      debugForDev(['图片信息：data:image/png;base64,{}', images.toBase64(clip)])
    }
    if (config.develop_mode) {
      debugForDev(['图片信息：data:image/png;base64,{}', images.toBase64(clip)])
    }
    let text = ocrUtil.recognize(screen, ocrRegion)
    if (text) {
      text = text.replace(/\n/g, '')
      let regex = /(\d+)分((\d+)秒)?/
      floatyInstance.setFloatyInfo({ x: ocrRegion[0], y: ocrRegion[1] }, '识别倒计时文本：' + text)
      sleep(500)
      let result = regex.exec(text)
      if (result && result.length > 0) {
        let remainMins = parseInt(result[1])
        let remainSecs = parseInt(result[3])
        debugInfo(['下次生产时间: {} 分 {} 秒', remainMins, remainSecs])
        if (!checkOnly) {
          commonFunctions.setUpAutoStart(remainMins + 1)
          NotificationHelper.createNotification('神奇海洋收集，' + (remainMins + 1) + '分钟后执行', 'OCR识别成功，下次执行时间：' + buildNextTime(remainMins + 1), NOTIFICATION_ID)
          NotificationHelper.createNotification('神奇海洋收集，' + (remainMins + 1) + '分钟后执行', 'OCR识别成功，下次执行时间：' + buildNextTime(remainMins + 1), NOTIFICATION_ID)
        }
        recognizeFailed = false
      }
    }
  }
  if (recognizeFailed && !checkOnly) {
    if (new Date().getHours() < 21) {
      warnInfo('OCR识别失败，' + (tryTime <= 3 ? '再次识别' : '失败超过三次，直接设置两小时后的定时任务'))
      if (tryTime <= 3) {
        sleep(500)
        checkNext(++tryTime)
      } else {
        commonFunctions.setUpAutoStart(120)
        NotificationHelper.createNotification('神奇海洋收集，两小时后执行', 'OCR识别失败，直接设置两小时后的定时任务，执行时间：' + buildNextTime(120), NOTIFICATION_ID)
        NotificationHelper.createNotification('神奇海洋收集，两小时后执行', 'OCR识别失败，直接设置两小时后的定时任务，执行时间：' + buildNextTime(120), NOTIFICATION_ID)
      }
    }
  }
  warningFloaty.enableTip()

}

function buildNextTime (mins) {
  let now = new Date()
  let next = new Date(now.getTime() + mins * 60 * 1000)
  return formatDate(next, 'HH:mm:ss')
}

function buildNextTime (mins) {
  let now = new Date()
  let next = new Date(now.getTime() + mins * 60 * 1000)
  return formatDate(next, 'HH:mm:ss')
}


function getOcrRegionByYolo () {
  if (!YoloDetectionUtil.enabled) {
    return null
  }
  let screen = commonFunctions.checkCaptureScreenPermission()
  let result = YoloDetectionUtil.forward(screen, { labelRegex: 'sea_ocr', confidence: config.yolo_confidence || 0.7 })
  if (result && result.length > 0) {
    let { x, y, width, height, label, confidence } = result[0]
    debugInfo(['yolo 识别ocr区域：「{}」confidence: {}', [x, y, width, height], confidence])
    let region = [x, y, width, height].map(v => parseInt(v))
    config.overwrite('sea_ocr_left', region[0])
    config.overwrite('sea_ocr_top', region[1])
    config.overwrite('sea_ocr_width', region[2])
    config.overwrite('sea_ocr_height', region[3])
    return region
  }
  return null
}

function doFindTrashs (screen) {
  if (YoloDetectionUtil.enabled) {
    let findBalls = YoloDetectionUtil.forward(screen, { labelRegex: 'sea_garbage|collect', confidence: config.yolo_confidence || 0.7 })
    if (findBalls && findBalls.length > 0) {
      findBalls.sort((a, b) => a.label == 'collect' ? 1 : -1)
      findBalls.forEach(b => {
        warningFloaty.addRectangle(b.label, [b.x, b.y, b.width, b.height])
      })
    }
    return findBalls
  } else {
    let grayImgInfo = images.grayscale(images.medianBlur(screen, 5))
    let findBalls = images.findCircles(
      grayImgInfo,
      {
        param1: config.hough_param1 || 30,
        param2: config.hough_param2 || 30,
        minRadius: config.sea_ball_radius_min || cvt(20),
        maxRadius: config.sea_ball_radius_max || cvt(35),
        minDst: config.hough_min_dst || cvt(100),
        region: config.sea_ball_region
      }
    )
    findBalls = findBalls.map(ball => {
      ball.x = ball.x + config.sea_ball_region[0]
      ball.y = ball.y + config.sea_ball_region[1]
      return ball
    })
    return findBalls
  }
}

function findStrollBtn () {
  let screen = commonFunctions.checkCaptureScreenPermission()
  if (YoloDetectionUtil.enabled) {
    logFloaty.pushLog('YOLO查找找拼图')
    let btn = YoloDetectionUtil.forward(screen, { labelRegex: 'stroll_btn', confidence: config.yolo_confidence || 0.7 })
    if (btn && btn.length > 0) {
      return btn[0]
    }
  } else {
    logFloaty.pushLog('OCR查找找拼图')
    let bounds = ocrUtil.recognizeWithBounds(screen, [config.device_width / 2, config.device_height / 2, config.device_width / 2, config.device_height / 2], '找拼图')
    if (bounds && bounds.length > 0) {
      bounds = btn[0].bounds
      return { x: bounds.centerX(), y: bounds.centerY() }
    }
  }
  return null
}
function waitForStrollBtn () {
  logFloaty.pushLog('等待加载完成，目标元素 找拼图')
  if (YoloDetectionUtil.enabled) {
    return yoloWait('stroll_btn', null, () => config.collecting_friends)
  } else {
    return ocrWait('找拼图', null, () => config.collecting_friends)
  }
}

/**
 * 打开任务窗口
 */
function openTaskWindow () {
  if (!YoloDetectionUtil.enabled) {
    logFloaty.pushErrorLog('领奖励需要YOLO支持')
    warnInfo(['领取奖励功能需要开启YOLO'], true)
    return false
  }
  
  let reward = YoloDetectionUtil.forward(commonFunctions.captureScreen(), { labelRegex: 'reward', confidence: config.yolo_confidence || 0.7 })
  if (reward && reward.length > 0) {
    reward = reward[0]
    floatyInstance.setFloatyInfo({ x: reward.centerX, y: reward.centerY }, '领奖励')
    clickPoint(reward.centerX, reward.centerY)
    sleep(1000)
  }
  return isInTaskUI()
}

/**
 * 获取当前界面是否在项目界面
 */
function isInProjectUI (timeout) {
  timeout = timeout || 2000
  return widgetUtils.idWaiting('ocean-info', '神奇海洋', timeout) || widgetUtils.idWaiting('ocean-fish-cnt-percent', '神奇海洋', timeout)
}

/**
 * 获取当前界面是否在任务界面
 */
function isInTaskUI(timeout) {
  timeout = timeout || 2000
  return widgetUtils.widgetWaiting('邀请.*好友一起修复海洋', '任务列表', timeout)
}

function backToTaskUI() {
  warnInfo('检查是否在任务界面，不在的话返回，尝试两次')
  let backResult = false
  let waitCount = 2
  while (!(backResult=isInTaskUI(5000)) && waitCount-->0) {
    automator.back()
    sleep(1000)
  }

  if (backResult) {
    sleep(2000)
    return true
  }
  
  warnInfo(['返回失败，重新尝试打开任务界面'])
  if (!isInProjectUI()) {
    warnInfo(['不在项目界面，重新尝试打开项目'])
    startApp()
  }

  if (!isInProjectUI()) {
    warnInfo(['打开项目失败，5分钟后重新尝试'])
    commonFunctions.setUpAutoStart(5)
    return false
  }

  if(!isInTaskUI()) {
    if (!openTaskWindow()) {
      warnInfo(['打开任务界面失败，5分钟后重新尝试'])
      commonFunctions.setUpAutoStart(5)
      return false
    }
  }
  return true
}

/**
 * 领取奖励
 */
function collectRewards () {
  if (openTaskWindow()) {
    //做任务
    doTaskByText()

    //领取奖励
    let collect = widgetUtils.widgetGetOne('立即领取', 1000)
    let limit = 5
    while (collect && limit-- > 0) {
      floatyInstance.setFloatyInfo({ x: collect.bounds().centerX(), y: collect.bounds().centerY() }, '立即领取')
      // automator.clickRandom(collect)
      collect.click()
      sleep(1000)
      let getBtn = widgetUtils.widgetGetOne('.*(收下|(欢迎|迎回).*伙伴|返回).*')
      if (getBtn) {
        automator.clickRandom(getBtn)
        sleep(1000)
        if (getBtn.text()=='迎回海洋伙伴') {
          sleep(2000)
          getBtn = widgetUtils.widgetGetOne('.*返回.*')
          if (getBtn) {
            automator.clickRandom(getBtn)
            sleep(1000)
          }
        }
        limit++
      }
      collect = widgetUtils.widgetGetOne('立即领取', 1000)
    }
    automator.back()
  }
}

function answerQuestion(titleObj,entryBtn) {
  let ai_type = config.ai_type || 'kimi'
  let kimi_api_key = config.kimi_api_key
  let chatgml_api_key = config.chatgml_api_key

  let key = ai_type === 'kimi' ? kimi_api_key : chatgml_api_key
  if (!key) {
    logFloaty.pushLog('推荐去KIMI开放平台申请API Key并在可视化配置中进行配置')
    logFloaty.pushLog('否则免费接口这个智障AI经常性答错')
  }
  
  let result = false
  if (entryBtn) {
    logFloaty.pushLog('等待进入 '+titleObj.text())
    entryBtn.click()
    sleep(3000)

    let questionRoot = widgetUtils.widgetGetOne('题目来源.*',5000)
    if (questionRoot && questionRoot.parent() && questionRoot.parent().childCount() > 1){
      questionRoot = questionRoot.parent().child(0)
      let result = AiUtil.getQuestionInfo(ai_type, key, questionRoot)
      if (result) {
        warnInfo('答案解释：' + result.describe)
        warnInfo('答案坐标：' + JSON.stringify(result.target))
        automator.clickPointRandom(result.target.x, result.target.y)
      }
    }
    sleep(1000)
    automator.back()
    sleep(1000)
  }
  return !!result
}

function doBrowseTask(titleText, entryBtn, timeout, needScroll) {
  if (!entryBtn) {
    logFloaty.pushLog('无入口按钮，跳过执行：'+titleText)
    return false
  }
  titleText = titleText || entryBtn.text()
  timeout = timeout || 15

  entryBtn.click()
  sleep(1000)
  logFloaty.pushLog('等待进入 '+titleText)
  sleep(2000);

  if (timeout) {
    logFloaty.pushLog(titleText+' 等待倒计时结束')
    let limit = timeout
    while (limit-- > 0) {
      sleep(1000)
      logFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
      if (limit % 2 == 0 && needScroll) {
        automator.randomScrollDown()
      }
    }
  } else {
    sleep(3000)
    logFloaty.pushLog('啥也不用干 直接返回')
  }
  return backToTaskUI()
}

function doVisitAppTask(titleText,entryBtn,timeout,needScroll) {
  if (!commonFunctions.checkAppInstalledByName(titleText)) {
    logFloaty.pushLog('未安装应用，跳过执行：'+titleText)
    return false
  }
  
  currentRunning = commonFunctions.myCurrentPackage()
  debugInfo('当前包名：'+currentRunning)
  entryBtn.click()

  logFloaty.pushLog('等待进入 '+titleText)
  let waitCount = 10
  while (currentRunning == commonFunctions.myCurrentPackage() && waitCount-- > 0) {
    sleep(1000)
  }
  if (currentRunning == commonFunctions.myCurrentPackage()) {
    logFloaty.pushLog('进入失败，返回')
    waitCount = 2
    while (!isInTaskUI() && waitCount-->0) {
      automator.back()
      sleep(1000)
    }
    
    if (!isInTaskUI()) {
      warnInfo(['返回失败，5分钟后重新尝试'])
      commonFunctions.setUpAutoStart(5)
      return false
    }
  }
  //已进入目标应用，等待加载完成
  sleep(5000)

  //根据需要等待一段时间进行浏览
  if (timeout) {
    logFloaty.pushLog(titleText+' 等待倒计时结束')
    let limit = timeout / 2
    while (limit-- > 0) {
      //检查是否有弹窗
      let popupCancelBtn = widgetUtils.widgetGetOne("^取消|忽略|关闭|拒绝$", 1000, false, false, m => m.boundsInside(0,  config.device_height * 0.2, config.device_width, config.device_height))
      if (popupCancelBtn) {
        debugInfo('找到了弹窗取消按钮')
        automator.clickRandom(popupCancelBtn)
        sleep(1000)
      }
      //检查是否有验证窗口，有则等待直到消失
      commonFunctions.waitForTBVerify()

      sleep(1000)
      logFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
      if (limit % 2 == 0 && needScroll) {
        automator.randomScrollDown()
      }
    }
  } else {
    sleep(3000)
    logFloaty.pushLog('啥也不用干 直接返回')
  }
  commonFunctions.minimize()
  sleep(1000)
  if (currentRunning != commonFunctions.myCurrentPackage()) {
    logFloaty.pushLog('未返回原应用，直接打开 '+ currentRunning)
    app.launch(currentRunning);
    sleep(3000)
  }

  return backToTaskUI()
}

function doCommonTask(titleText, entryBtn, timeout, needScroll) {
  if (!commonFunctions.checkAppInstalledByName(titleText)) {
    logFloaty.pushLog('未安装应用，跳过执行：'+titleText)
    return false
  }
  
  if (!entryBtn) {
    logFloaty.pushLog('无入口按钮，跳过执行：'+titleText)
    return false
  }
  titleText = titleText || entryBtn.text()
  timeout = timeout || 15
  let taskType = 'browse'

  currentRunning = commonFunctions.myCurrentPackage()
  debugInfo('当前包名：'+currentRunning)
  
  entryBtn.click()
  logFloaty.pushLog('等待进入 '+titleText+', 计时：'+timeout+', 滑动：'+needScroll)
  commonFunctions.waitForAction(10, titleText, function () {
    let popupConfirmBtn = widgetUtils.widgetGetOne("^允许$", 1000, false, false, (m) =>
      m.boundsInside(0, config.device_height * 0.2, config.device_width, config.device_height)
    );
    if (popupConfirmBtn) {
      debugInfo("找到了弹窗确认按钮");
      automator.clickRandom(popupConfirmBtn);
      sleep(5000)
      return true
    }
    return false
  });

  if (currentRunning != commonFunctions.myCurrentPackage()) {
    taskType = 'visitapp'
    //已进入目标应用，等待加载完成
    sleep(5000)
  } else if (isInTaskUI()) {
    logFloaty.pushLog('进入任务失败：'+titleText)
    return false
  }

  //检查是否有验证窗口，有则等待直到消失
  commonFunctions.waitForTBVerify()

  //根据需要等待一段时间进行浏览
  if (timeout) {
    logFloaty.pushLog(titleText+' 等待倒计时结束')
    let limit = timeout
    while (limit-- > 0) {
      //检查是否有弹窗
      let popupCancelBtn = widgetUtils.widgetGetOne("^取消|忽略|关闭|拒绝$", 1000, false, false, m => m.boundsInside(0,  config.device_height * 0.2, config.device_width, config.device_height))
      if (popupCancelBtn) {
        debugInfo('找到了弹窗取消按钮')
        automator.clickRandom(popupCancelBtn)
      }

      logFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
      if (limit % 2 == 0 && needScroll) {
        automator.scrollUpAndDown()
        sleep(100)
      } else {
        sleep(1000)
      }
    }
  } else {
    sleep(3000)
    logFloaty.pushLog('啥也不用干 直接返回')
  }
  if (taskType == 'visitapp') {
    commonFunctions.minimize()
    sleep(1000)
    if (currentRunning != commonFunctions.myCurrentPackage()) {
      logFloaty.pushLog('未返回原应用，直接打开 '+ currentRunning)
      app.launch(currentRunning);
      sleep(3000)
    }
  }

  automator.back()
  sleep(1000)
  return true
}

function doSpecialTask(action,titleObj,entryBtn) {
  if (!titleObj||!entryBtn) {
    return false
  }
  switch(action) {
    case 'answerQuestion':
      return answerQuestion(titleObj,entryBtn)
    default:
      return false
  }
}

function scrollUpTop () {
  let limit = 5
  do {
    automator.randomScrollUp(config.device_height*0.35,config.device_height*0.40,null,null,true)
  } while (limit-- > 0)
}

function doTaskByText (force) {
  logFloaty.pushLog('执行每日任务')

  let hasTask = false
  let limit = 3

  while (limit-- > 0) {
    automator.randomScrollDown(null,null,config.device_height*0.35,config.device_height*0.40)
    sleep(1000)
  }

  let taskInfos = [
    // 去答题|立即领取
    {btnRegex:'去答题', tasks:[
      {taskType:'answerQuestion',titleRegex:'.*'},
    ]},
    // 去看看|立即领取
    {btnRegex:'去看看', tasks:[
      {taskType:'browse',titleRegex:'.*逛一逛市集.*',timeout:15,needScroll:true},
      {taskType:'browse',titleRegex:'.*信用卡.*得能量.*',timeout:10,needScroll:false},
      {taskType:'browse',titleRegex:'.*去庄园.*',timeout:3,needScroll:false},
      {taskType:'browse',titleRegex:'.*逛一逛余额宝.*',timeout:15,needScroll:false},
      {taskType:'browse',titleRegex:'.*去逛.*会场.*',timeout:15,needScroll:true},
      {taskType:'browse',titleRegex:'.*逛逛.*频道.*',timeout:10,needScroll:true},
    ]},
    // 去逛逛|立即领取
    {btnRegex:'去逛逛', tasks:[
      {taskType:'browse',titleRegex:'.*逛逛花呗.*',timeout:15,needScroll:true},
      {taskType:'browse',titleRegex:'.*支付宝会员.*',timeout:3,needScroll:false},
      {taskType:'browse',titleRegex:'.*逛逛支付宝芭芭农场.*',timeout:10,needScroll:false},
      {taskType:'browse',titleRegex:'.*去看看.*会场.*',timeout:15,needScroll:true},
      {taskType:'browse',titleRegex:'.*去逛饿了么.*',timeout:15,needScroll:false},
      {taskType:'app',titleRegex:'.*逛一逛闲鱼.*',timeout:20,needScroll:false},
      {taskType:'app',titleRegex:'.*逛一逛淘宝.*',timeout:15,needScroll:false},
      {taskType:'app',titleRegex:'.*去逛淘宝.*',timeout:15,needScroll:false},
      {taskType:'app',titleRegex:'.*逛一逛点淘.*',timeout:20,needScroll:true},
      {taskType:'app',titleRegex:'.*去淘宝.*视频.*',timeout:20,needScroll:true},
      {taskType:'app',titleRegex:'.*逛淘金币.*',timeout:10,needScroll:false},
      {taskType:'app',titleRegex:'.*去快手.*',timeout:10,needScroll:false},
      {taskType:'app',titleRegex:'.*去饿了么.*',timeout:10,needScroll:false},
      {taskType:'app',titleRegex:'.*去淘宝.*',timeout:15,needScroll:true},
    ]},
  ]

  do {
    hasTask = false
    for (let i = 0; i < taskInfos.length; i++) {
      let taskInfo = taskInfos[i]
      let btns = widgetUtils.widgetGetAll(taskInfo.btnRegex, 3000)
      if (btns && btns.length > 0) {
        btns.forEach(btn => {
          let titleObj = commonFunctions.getTaskTitleObj(btn)
          if (titleObj) {
            let titleText = titleObj.text()
            logFloaty.pushLog('发现任务：'+titleText)
            for (let j = 0; j < taskInfo.tasks.length; j++) {
              let task = taskInfo.tasks[j]
              if (titleText.match(task.titleRegex)) {
                logFloaty.pushLog('开始执行任务：'+titleText)
                if (task.taskType == 'browse') {
                  hasTask = doCommonTask(titleText, btn, task.timeout, task.needScroll) || hasTask
                } else if (task.taskType == 'app') {
                  hasTask = doCommonTask(titleText, btn, task.timeout, task.needScroll) || hasTask
                } else {
                  hasTask = doSpecialTask(task.taskType, titleObj, btn) || hasTask
                }
                backToTaskUI()
                break
              }
            }
          }
        })
      }
    }
  } while (hasTask)
  scrollUpTop()
}

function yoloWait (labelRegex, limit, checker) {
  limit = limit || 5
  checker = checker || function () { return true }
  if (YoloDetectionUtil.enabled) {
    do {
      let result = YoloDetectionUtil.forward(commonFunctions.captureScreen(), { labelRegex: labelRegex, confidence: config.yolo_confidence || 0.7 })
      if (result && result.length > 0) {
        return true
      }
      sleep(500)
    } while (limit-- > 0 && checker())
  }
  return false
}

function ocrWait (text, limit, checker) {
  limit = limit || 5
  checker = checker || function () { return true }
  do {
    let screen = commonFunctions.checkCaptureScreenPermission()
    let result = ocrUtil.recognize(screen)
    if (result && result.indexOf(text) >= 0) {
      return true
    }
    sleep(500)
  } while (limit-- > 0 && checker())
  return false
}