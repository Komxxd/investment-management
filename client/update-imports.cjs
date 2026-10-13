const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replace = (regex, replacement) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  };

  if (file.endsWith('App.tsx')) {
    // App.tsx moved from src/App.tsx to src/app/App.tsx, so all sibling imports need ../
    replace(/from '\.\/supabaseClient'/g, "from '../lib/supabase'");
    replace(/from '\.\/api'/g, "from '../services/api/client'");
    replace(/from '\.\/components\/Auth'/g, "from '../features/auth/components/Auth'");
    replace(/from '\.\/components\/CreatePortfolioModal'/g, "from '../features/portfolio/components/CreatePortfolioModal'");
    replace(/from '\.\/components\/RenamePortfolioModal'/g, "from '../features/portfolio/components/RenamePortfolioModal'");
    replace(/from '\.\/components\/PortfolioInfoModal'/g, "from '../features/portfolio/components/PortfolioInfoModal'");
    replace(/from '\.\/components\/RecycleBinModal'/g, "from '../features/portfolio/components/RecycleBinModal'");
    replace(/from '\.\/components\/AddStockModal'/g, "from '../features/stocks/components/AddStockModal'");
    replace(/from '\.\/components\/SellStockModal'/g, "from '../features/stocks/components/SellStockModal'");
    replace(/from '\.\/components\/EditStockModal'/g, "from '../features/stocks/components/EditStockModal'");
    replace(/from '\.\/components\/EditSoldStockModal'/g, "from '../features/stocks/components/EditSoldStockModal'");
    replace(/from '\.\/components\/AssetSearch'/g, "from '../features/stocks/components/AssetSearch'");
    replace(/from '\.\/components\/RebalanceModal'/g, "from '../features/stocks/components/RebalanceModal'");
    replace(/from '\.\/components\/CorporateActionsViewerModal'/g, "from '../features/stocks/components/CorporateActionsViewerModal'");
    replace(/from '\.\/components\/CorporateActionModal'/g, "from '../features/stocks/components/CorporateActionModal'");
    replace(/from '\.\/components\/ConfirmationModal'/g, "from '../components/ui/ConfirmationModal'");
    replace(/import '\.\/App\.css'/g, "import '../styles/App.css'");
  } else if (file.endsWith('main.tsx')) {
    replace(/import App from '\.\/App'/g, "import App from './app/App'");
    replace(/import '\.\/index\.css'/g, "import './styles/index.css'");
  } else {
    // Components were in src/components/, now they are in src/features/.../components/ or src/components/ui/
    // So ../api -> ../../../services/api/client
    // ../supabaseClient -> ../../../lib/supabase
    replace(/from '\.\.\/api'/g, "from '../../../services/api/client'");
    replace(/from '\.\.\/supabaseClient'/g, "from '../../../lib/supabase'");
    
    // Sibling imports inside components
    replace(/from '\.\/ConfirmationModal'/g, "from '../../../components/ui/ConfirmationModal'");
    replace(/from '\.\/AssetSearch'/g, "from '../../stocks/components/AssetSearch'");
    replace(/from '\.\/CorporateActionModal'/g, "from '../../stocks/components/CorporateActionModal'");
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
