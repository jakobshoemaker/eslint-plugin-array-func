/**
 * @author Martin Giger
 * @license MIT
 */
"use strict";

module.exports = {
    meta: {
        docs: {
            description: "Prefer using the mapFn callback of Array.from over an immediate .map() call.",
            recommended: true
        },
        fixable: "code",
        schema: []
    },
    create(context) {
        return {
            "CallExpression:exit"(node) {
                if(!node.callee || node.callee.type !== "MemberExpression" || node.callee.property.name !== "map") {
                    return;
                }
                const { callee } = node,
                    { object: parent } = callee;

                if(!parent.callee || parent.callee.type !== "MemberExpression" || parent.callee.property.name !== "from" || !parent.callee.object || parent.callee.object.type !== "Identifier" || parent.callee.object.name !== "Array") {
                    return;
                }

                context.report({
                    node: callee.property,
                    loc: {
                        start: parent.callee.loc.start,
                        end: callee.loc.end
                    },
                    message: "Use mapFn callback of Array.from instead of map()",
                    fix(fixer) {
                        const HAS_CBK = 2,
                            PARAM_SEPARATOR = ", ",
                            FUNCTION_END = ")",
                            sourceCode = context.getSourceCode();

                        // Merge the from and map callbacks
                        if(parent.arguments.length >= HAS_CBK) {
                            const OMIT_ITEM = 1,
                                [
                                    mapCallback,
                                    mapThisArg
                                ] = node.arguments,
                                [
                                    _, // eslint-disable-line no-unused-vars
                                    callback,
                                    thisArg
                                ] = parent.arguments,
                                params = callback.params.length > mapCallback.params.length ? callback.params : mapCallback.params,
                                paramString = params.map((p) => p.name).join(PARAM_SEPARATOR),
                                getCallback = (cbk, targ, ps) => {
                                    const source = `(${sourceCode.getText(cbk)})`;
                                    if(targ && cbk.type !== "ArrowFunctionExpression") {
                                        return `${source}.call(${targ.name}${PARAM_SEPARATOR}${ps})`;
                                    }
                                    return `${source}(${ps})`;
                                },
                                firstCallback = getCallback(callback, { name: 'this' }, paramString);

                            let functionStart = `(${paramString}) => `,
                                functionEnd = "",
                                restParamString = '';
                            if(thisArg && callback.type !== "ArrowFunctionExpression") {
                                functionStart = `function(${paramString}) { return `;
                                functionEnd = "; }";
                            }
                            if(params.length > OMIT_ITEM) {
                                const restParams = params
                                    .slice(OMIT_ITEM)
                                    .map((p) => p.name);
                                restParamString = PARAM_SEPARATOR + restParams.join(PARAM_SEPARATOR);
                            }
                            const lastCallback = getCallback(mapCallback, mapThisArg, `${firstCallback}${restParamString}`),
                                restParams = sourceCode.getText().substring(callback.end, parent.end);
                            return fixer.replaceTextRange([
                                callback.start,
                                node.end
                            ], `${functionStart}${lastCallback}${functionEnd}${restParams}`);
                        }

                        // Move the map arguments to from.
                        const [ firstArgument ] = node.arguments;
                        return fixer.replaceTextRange([
                            parent.end - FUNCTION_END.length,
                            firstArgument.start
                        ], PARAM_SEPARATOR);
                    }
                });
            }
        };
    }
};