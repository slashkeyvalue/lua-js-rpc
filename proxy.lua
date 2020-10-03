Rpc = {}
Rpc.references = {}
Rpc.promises = {}

Rpc.Register = function(refId, ref)
    if type(ref) == 'function' then
        ref = Citizen.GetFunctionReference(ref)
    end

    if not ref then
        Citizen.Trace('Invalid ref registration attempt: ' .. refId .. "\n")
        return
    end

    Rpc.references[refId] = ref
end

Rpc.Invoke = function(refId, ...)
    if not coroutine.running() then
		error('Rpc delegates can only be invoked from a thread.')
    end
    
    local args = {...}

    local promiseId = #Rpc.promises + 1
    local p = promise.new()
    Rpc.promises[promiseId] = p;

    TriggerEvent('__rpc_js_rpcReq', promiseId, refId, table.unpack(args));

    return Citizen.Await(p)
end

Rpc.Request = function(promiseId, refId, args)
    local resolve = function()
        local ref = Rpc.references[refId];

        if not ref then
            Citizen.Trace('Invalid ref call attempt: ' .. refId .. "\n")
            return nil
        end
        
        return msgpack.unpack(Citizen.InvokeFunctionReference(ref, msgpack.pack(table.unpack(args))))
    end

    local r = resolve()

    TriggerEvent('__rpc_js_rpcAsw', promiseId, r)
end

AddEventHandler('__rpc_lua_rpcReq', Rpc.Request)

AddEventHandler('__rpc_lua_rpcAsw', 
    function(promiseId, retvals)
        local p = Rpc.promises[promiseId]

        if p then
            p:resolve(retvals)

            Rpc.promises[promiseId] = nil
        end
    end
)

setmetatable(Rpc,
    {
        __index = function(table, key, value)
            return function(...)
                local args = {...} 

                return Rpc.Invoke(key, args)
            end
        end,
        __call = function(...)

            local args = {...}

            local _self = args[1]
            local refId = args[2]
            local ref   = args[3]

            if refId and ref then
                Rpc.Register(refId, ref)
            end
        end
    }
);

--[[
Rpc('GetLuaRpcVersion', 
    function(versionTwo, teste)
        local version = '-1.1.0'

        if versionTwo then
            version = '1.1.0'
        end

        return version
    end
)

Citizen.CreateThread(function()
    local rpcVersion = Rpc.GetJsRpcVersion(true)
    print('[Lua] JsRpcVersion ' .. rpcVersion)

    local mongoose = Rpc.GetMongoose()
    print('mongoose', mongoose)
end)
]]