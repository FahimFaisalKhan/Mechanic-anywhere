import React from "react";
import { useEffect } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

const PaymentSuccess = () => {
  //   const location = useLocation();

  //   const transId = new URLSearchParams(location.search).get("tansId");
  //   console.log(transId);
  const [searchParams] = useSearchParams();

  const transId = searchParams.get("tansId");

  const [order, setOrder] = useState({});

  useEffect(() => {
    fetch(`http://localhost:5000/orders/by-transaction-id/${transId}`)
      .then((res) => res.json())
      .then((data) => setOrder(data));
  }, [transId]);

  if (!order?._id) {
    return <div>No order found</div>;
  }
  return (
    <div>
      <h2>Congrats! payment successfull</h2>
      <h3>Your order Summary</h3>
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Price</th>
              <th>Shipping Address</th>
              <th>Transactin ID</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>1</th>
              <td>{order.serviceName}</td>
              <td>{order.price}</td>
              <td>{order.address}</td>
              <td>{transId}</td>
            </tr>
          </tbody>
        </table>
        <button
          className="btn btn-primary ml-auto mt-5 block print:hidden"
          onClick={() => window.print()}
        >
          Print Invoice
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
