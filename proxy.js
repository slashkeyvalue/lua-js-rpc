const internalRpc = {};
internalRpc.references = {};
internalRpc.resolvers = {};

internalRpc.resolvers.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

internalRpc.Register = (refId, ref) =>
{
    if (typeof ref == 'function')
    {
        //ref = Citizen.makeRefFunction(ref);
    }

    if (!ref)
    {
        Citizen.Trace(`Invalid ref registration attempt: ${refId}\n`);
        return;
    }

    internalRpc.references[refId] = ref;
}

internalRpc.Invoke = async (refId, ...args) =>
{
    const promiseId = internalRpc.resolvers.size() + 1;

    let resolver;
    let p = new Promise((resolve, reject) => {resolver = resolve});

    internalRpc.resolvers[promiseId] = resolver;

    TriggerEvent('__rpc_lua_rpcReq', promiseId, refId, args);

    return await p;
}

internalRpc.Request = async (promiseId, refId, args) =>
{
    const resolve = async () =>
    {
        const ref = internalRpc.references[refId];

        if (!ref)
        {
            Citizen.Trace(`Invalid ref call attempt: ${refId}\n`);;
            return undefined;
        }

        //ref = Citizen.makeFunctionReference(ref);

        const returnvals = await ref(...args);

        return returnvals
    }

    const returnvals = await resolve();

    TriggerEvent('__rpc_lua_rpcAsw', promiseId, returnvals);
}

on('__rpc_js_rpcReq', internalRpc.Request);

on('__rpc_js_rpcAsw', (promiseId, retvals) =>
    {
        const resolver = internalRpc.resolvers[promiseId];        

        if (resolver)
        {

            switch(retvals.length)
            {
                case 0:
                    retvals = undefined;
                    break;
                case 1:
                    retvals = retvals[0];
                    break;
                default:
                    break;
            }

            resolver(retvals);

            delete internalRpc.resolvers[promiseId];
        }
    }
);

const RpcFn = function(...params) {};

const Rpc = new Proxy(RpcFn,
    {
        get(target, p, receiver)
        {
            return async function()
            {
                return await internalRpc.Invoke(p, Array.from(arguments));
            }
        },
        apply(target, thisArg, argArray)
        {
            const refId = argArray[0];
            const ref = argArray[1];

            internalRpc.Register(refId, ref);
        }
    }
);

//export default Rpc;

/*
Rpc('GetJsRpcVersion', (versionTwo) => 
    {
        let version = '-2.1.0';

        if (versionTwo == true)
        {
            version = '2.1.0';
        }

        return version;
    }
);

Rpc('GetMongoose', () => {return 'mongoose'});

async function Teste()
{
    setTimeout( async() =>
    {
        const rpcVersion = await Rpc.GetLuaRpcVersion(false, false);
        console.log(`[JS] LuaRpcVersion ${rpcVersion}\n`);
    }, 0);
}
Teste();
*/