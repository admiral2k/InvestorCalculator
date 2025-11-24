# Investor Calculator 💹
A modern Angular application that estimates how investments grow over time using real market data (no API keys), local caching, and a deterministic demo fallback.


## 🖥 Preview
![Demonstration of functionality ](https://github.com/user-attachments/assets/af57e178-5f25-4bdd-b921-158ea2680843)

## 🚀 Features
- Real historical stock data (CSV endpoint)
- Three data modes: real, cached, demo
- No API keys required
- Deterministic fallback demo values
- Per‑ticker investment breakdown
- Total summary row
- Clean UI with standalone Angular components

## 📊 Data Modes
### 1. Real Mode
Used when CSV API returns valid data.

### 2. Cached Mode
If API is rate‑limited, cached CSV (24h TTL) is used.

### 3. Demo Mode
If no cache and API limited: deterministic synthetic buy/sell pair is generated.

## 📡 Data Retrieval Pipeline
1. Try cache  
2. If no cache → network request  
3. Rate‑limit → use cache or demo  
4. Invalid CSV → skip or demo  

## 🧪 Demo Mode Logic
Deterministic synthetic values based on hashed ticker+date.

## 🔧 Customizable Tickers
Default list is defined in `stocks.service.ts`:
```ts
top10 = ['AAPL','MSFT','AMZN','GOOGL','NVDA','META','TSLA','JPM','V','UNH','MA','BRK.B'];
```
You can pass your list manually.




## 📦 Installation
```bash
git clone https://github.com/admiral2k/investor-calculator.git
cd investor-calculator
npm install
npm start
```

## 📝 Roadmap
- Add performance charts
- Export CSV/PDF
- Implement recurring investments

## 📄 License
MIT © admiral2k
