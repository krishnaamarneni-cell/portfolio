---
title: Options Basics
source: seed
tags: [finance, options, hedging, derivatives]
loaded: 2026-04-20
---

# Options Basics

Options are contracts, not stocks. You pay a premium for the right (not the obligation) to transact at a fixed price by a fixed date. They're asymmetric: the buyer's max loss is the premium; the seller's max loss can be much larger.

## The four building blocks

- **Long call**: right to buy at the strike by expiration. Pays off if the stock rises above strike + premium. Max loss is the premium.
- **Long put**: right to sell at the strike. Pays off if the stock falls below strike − premium. Max loss is the premium.
- **Short (written) call**: obligation to sell at strike if exercised. You collect premium; your loss is theoretically unlimited.
- **Short put**: obligation to buy at strike. Max loss = strike × shares − premium (stock can only go to zero).

Every more "exotic" option position (spreads, condors, strangles) is a combination of those four blocks.

## Moneyness

- **ITM (in the money)**: exercising now has intrinsic value.
- **ATM (at the money)**: strike ≈ current price.
- **OTM (out of the money)**: no intrinsic value, only time value.

OTM options are cheaper but require a larger move to pay off. A 5% OTM 30-day call is a very different bet than a 1% OTM 90-day call.

## The Greeks

Greeks are partial derivatives of the option price — how much the price changes with one variable, holding others constant.

- **Delta**: sensitivity to the underlying's price. A call's delta runs 0 (deep OTM) to 1 (deep ITM); a put runs 0 to −1. ATM options are ~0.5 delta. Treat delta as a rough probability-of-expiring-ITM at option expiry.
- **Gamma**: how fast delta changes with the underlying. Highest near ATM close to expiration. Gamma is why short-dated ATM options are "twitchy".
- **Theta**: decay in value per day from time passing. Options lose time value non-linearly — most of the decay happens in the last 30 days. As a buyer, theta works against you; as a seller, it works for you.
- **Vega**: sensitivity to implied volatility. If IV jumps (e.g., before earnings), options get more expensive. Buying before earnings and selling after without a big move is a classic way to lose to "vol crush".

## Practical strategies

- **Protective put**: own a stock, buy a put as insurance. Caps your downside at the strike; reduces return by the premium. Useful around known events (earnings, elections).
- **Covered call**: own a stock, sell a call against it. You collect premium in exchange for capping upside at the strike. Best when you'd sell anyway at that price.
- **Cash-secured put**: sell a put, hold enough cash to buy the shares if assigned. A way to get paid to wait for a price you'd buy at anyway.
- **Vertical spread**: buy one option, sell another at a different strike (same type, same expiration). Caps both loss and profit. Cheaper than a naked option, with defined risk.

## Hedging your stock portfolio

For a concentrated single-name position, the simplest hedge is a protective put on that name. For a broad stock portfolio, a put on SPY or QQQ roughly matches market exposure. Two caveats: hedges cost money over time (premium decay), and hedging what you should just be selling is usually the wrong trade.

## Risks beginners underestimate

- **Early assignment** on short options, especially around ex-dividend dates.
- **Margin calls** on short positions if IV spikes.
- **Liquidity**: wide bid/ask spreads on thinly-traded options eat returns.
- **Tax**: most options are short-term capital gains; some (broad index) have the 60/40 treatment. Check with a CPA.
