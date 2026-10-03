import { Link } from 'react-router-dom';
export default function NotFound() {
  return <div className="pad empty"><h1>This page wandered off.</h1><Link to="/" className="btn btn-primary">Back to Explore</Link></div>;
}
