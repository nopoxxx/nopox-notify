-- Бэкенд nopox-notify: фронтенд (в песочнице Steam) не может запускать программы — это делает он.
local logger     = require("logger")
local millennium = require("millennium")

-- журнал загрузки и ошибок, без текста уведомлений: логи бэкенда Millennium видны только
-- в его окне, а файл можно читать снаружи
local LOG = os.getenv("HOME") .. "/.cache/nopox-notify.log"

---@ffi
--- Строка в ~/.cache/nopox-notify.log (фронтенд пишет сюда же)
---@param msg string
---@return boolean
function log(msg)
    local f = io.open(LOG, "a")
    if not f then return false end
    f:write(os.date("%Y-%m-%d %H:%M:%S "), tostring(msg), "\n")
    f:close()
    return true
end

local function q(s)
    return "'" .. (tostring(s or ""):gsub("'", "'\\''")) .. "'"
end

---@ffi
--- Показать уведомление через notify-send (его подхватит nopox-shell или любой другой демон)
---@param title string
---@param body string
---@param urgency string
---@return boolean
function notify(title, body, urgency)
    -- окружение Steam (LD_LIBRARY_PATH рантайма) ломает системные программы — чистим
    local cmd = "env -u LD_LIBRARY_PATH -u LD_PRELOAD notify-send -a Steam -i steam -u " .. q(urgency)
        .. " -- " .. q(title) .. " " .. q(body) .. " >/dev/null 2>&1 &"
    local ok = os.execute(cmd)
    if not ok then
        logger:error("notify-send failed")
        log("notify-send failed")
    end
    return ok and true or false
end

local function on_load()
    logger:info("nopox-notify loaded, Millennium " .. millennium.version())
    log("backend loaded, Millennium " .. millennium.version())
    millennium.ready()
end

return {
    on_load = on_load,
}
